package expo.modules.eidonalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("taskId") ?: return
        Log.d("EidonAlarm", "AlarmReceiver onReceive for taskId: $taskId")

        // Store the taskId in SharedPreferences so JS can always find it
        val prefs = context.getSharedPreferences("eidon_alarm_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("enqueued_task_id", taskId).apply()

        val serviceIntent = Intent(context, AlarmService::class.java).apply {
            putExtra("taskId", taskId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
