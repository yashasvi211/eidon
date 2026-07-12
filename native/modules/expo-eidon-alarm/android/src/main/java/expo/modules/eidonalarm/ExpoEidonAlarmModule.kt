package expo.modules.eidonalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoEidonAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoEidonAlarm")

    Function("scheduleAlarm") { taskId: String, triggerTimeMs: Double ->
      val context = appContext.reactContext
      if (context != null) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java).apply {
          putExtra("taskId", taskId)
        }

        val pendingIntent = PendingIntent.getBroadcast(
          context,
          taskId.hashCode(),
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          if (alarmManager.canScheduleExactAlarms()) {
            val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTimeMs.toLong(), pendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
          } else {
            alarmManager.setAndAllowWhileIdle(
              AlarmManager.RTC_WAKEUP,
              triggerTimeMs.toLong(),
              pendingIntent
            )
          }
        } else {
          val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTimeMs.toLong(), pendingIntent)
          alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
        }
        Log.d("EidonAlarm", "Alarm scheduled for taskId=$taskId at $triggerTimeMs")
      }
    }

    Function("cancelAlarm") { taskId: String ->
      val context = appContext.reactContext
      if (context != null) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
          context,
          taskId.hashCode(),
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.cancel(pendingIntent)
      }
    }

    Function("stopAlarm") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(context, AlarmService::class.java)
        context.stopService(intent)
        // Clear the shared preference
        val prefs = context.getSharedPreferences("eidon_alarm_prefs", Context.MODE_PRIVATE)
        prefs.edit().remove("enqueued_task_id").apply()
        Log.d("EidonAlarm", "stopAlarm called — service stopped, prefs cleared")
      }
    }

    Function("getEnqueuedAlarm") { ->
      var taskId: String? = null

      // Method 1: Check the activity intent extras
      val activity = appContext.currentActivity
      if (activity != null) {
        val intent = activity.intent
        if (intent?.getBooleanExtra("expo.modules.eidonalarm.isAlarm", false) == true) {
          taskId = intent.getStringExtra("expo.modules.eidonalarm.taskId")
          intent.removeExtra("expo.modules.eidonalarm.isAlarm")
          intent.removeExtra("expo.modules.eidonalarm.taskId")
          activity.intent = intent
          Log.d("EidonAlarm", "getEnqueuedAlarm: found via intent extras: $taskId")
        }
      }

      // Method 2: Check shared preferences (set by AlarmReceiver as a fallback)
      if (taskId == null) {
        val context = appContext.reactContext
        if (context != null) {
          val prefs = context.getSharedPreferences("eidon_alarm_prefs", Context.MODE_PRIVATE)
          val storedTaskId = prefs.getString("enqueued_task_id", null)
          if (storedTaskId != null) {
            taskId = storedTaskId
            prefs.edit().remove("enqueued_task_id").apply()
            Log.d("EidonAlarm", "getEnqueuedAlarm: found via SharedPreferences: $taskId")
          }
        }
      }

      taskId
    }

    // ── Overlay Permission (Draw Over Other Apps) ──

    Function("setAlarmSound") { soundUri: String ->
      val context = appContext.reactContext
      if (context != null) {
        val prefs = context.getSharedPreferences("eidon_alarm_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("alarm_sound_path", soundUri).apply()
        Log.d("EidonAlarm", "Alarm sound URI set to $soundUri")
      }
    }

    Function("getAlarmSound") { ->
      val context = appContext.reactContext
      if (context != null) {
        val prefs = context.getSharedPreferences("eidon_alarm_prefs", Context.MODE_PRIVATE)
        val uri = prefs.getString("alarm_sound_path", null)
        Log.d("EidonAlarm", "Alarm sound URI retrieved: $uri")
        uri
      } else {
        null
      }
    }

    Function("canDrawOverlays") { ->
      val context = appContext.reactContext
      if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true // Pre-M doesn't need this permission
      }
    }

    Function("openOverlaySettings") {
      val activity = appContext.currentActivity
      if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${activity.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
    }

    // ── Exact Alarm Permission ──

    Function("canScheduleExactAlarms") { ->
      val context = appContext.reactContext
      if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.canScheduleExactAlarms()
      } else {
        true // Pre-S doesn't need this
      }
    }

    Function("openExactAlarmSettings") {
      val activity = appContext.currentActivity
      if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${activity.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
      }
    }
  }
}
