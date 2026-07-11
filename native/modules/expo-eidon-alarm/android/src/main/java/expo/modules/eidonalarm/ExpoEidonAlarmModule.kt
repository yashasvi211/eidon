package expo.modules.eidonalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
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
      }
    }

    Function("getEnqueuedAlarm") { ->
      var taskId: String? = null

      // Method 1: Check the activity intent extras (set by AlarmService launching the activity)
      val activity = appContext.currentActivity
      if (activity != null) {
        val intent = activity.intent
        if (intent?.getBooleanExtra("expo.modules.eidonalarm.isAlarm", false) == true) {
          taskId = intent.getStringExtra("expo.modules.eidonalarm.taskId")
          // Clear the flag so we don't trigger it again on hot reload
          intent.removeExtra("expo.modules.eidonalarm.isAlarm")
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
            // Clear it after reading
            prefs.edit().remove("enqueued_task_id").apply()
          }
        }
      }

      taskId
    }
  }
}
