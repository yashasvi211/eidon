package expo.modules.eidonalarm

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

class AlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "eidon_alarm_channel"
        const val NOTIFICATION_ID = 1337
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val taskId = intent?.getStringExtra("taskId") ?: ""
        Log.d("EidonAlarm", "AlarmService onStartCommand taskId: $taskId")

        // 1. Acquire WakeLock to keep CPU alive
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "EidonAlarm::AlarmWakeLock"
        )
        wakeLock?.acquire(10 * 60 * 1000L /* 10 minutes max */)

        // 2. Build the launch intent for our main activity
        val packageName = applicationContext.packageName
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("expo.modules.eidonalarm.taskId", taskId)
            putExtra("expo.modules.eidonalarm.isAlarm", true)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            taskId.hashCode(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. Build the foreground notification with fullScreenIntent
        val notificationBuilder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }

        val appIconResId = resources.getIdentifier("ic_launcher", "mipmap", packageName)

        val notification = notificationBuilder
            .setContentTitle("Task Reminder")
            .setContentText("Tap to view your reminder")
            .setSmallIcon(if (appIconResId != 0) appIconResId else android.R.drawable.ic_dialog_info)
            .setCategory(Notification.CATEGORY_ALARM)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent) // Also allow tap-to-open
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC) // Show on lock screen
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // 4. ALSO directly launch the activity (don't rely solely on fullScreenIntent)
        //    This is the key fix — fullScreenIntent only auto-launches under certain conditions
        //    (device locked, USE_FULL_SCREEN_INTENT granted). We force-launch the activity ourselves.
        try {
            if (launchIntent != null) {
                // Dismiss keyguard if locked
                val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // On O+ we can request dismissal but the activity flags handle it
                }
                applicationContext.startActivity(launchIntent)
                Log.d("EidonAlarm", "Directly launched MainActivity for alarm")
            }
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to directly launch activity", e)
        }

        // 5. Play Sound
        try {
            val soundResId = resources.getIdentifier("notification_sound_1", "raw", packageName)
            Log.d("EidonAlarm", "Sound resource ID: $soundResId")
            if (soundResId != 0) {
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
                // Create MediaPlayer manually so we set AudioAttributes BEFORE prepare
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(audioAttributes)
                    val afd = resources.openRawResourceFd(soundResId)
                    setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                    afd.close()
                    isLooping = true
                    prepare()
                    start()
                }
                Log.d("EidonAlarm", "Alarm sound started playing successfully")
            } else {
                Log.w("EidonAlarm", "notification_sound_1 not found in res/raw!")
            }
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to play sound", e)
        }

        // 6. Vibrate
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 500, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to vibrate", e)
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d("EidonAlarm", "AlarmService onDestroy — stopping alarm")
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {}

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {}

        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {}

        // Remove the foreground notification
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {}
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Alarm Channel"
            val descriptionText = "Channel for full screen alarms"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
