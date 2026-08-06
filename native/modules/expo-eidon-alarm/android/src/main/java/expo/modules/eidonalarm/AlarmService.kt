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
    private var phase2Handler: android.os.Handler? = null
    private var phase2Runnable: Runnable? = null

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
        
        // Safely decode the app icon into a Bitmap, handling Adaptive Icons (XML) which BitmapFactory cannot decode
        var largeIconBitmap: android.graphics.Bitmap? = null
        if (appIconResId != 0) {
            try {
                val drawable = androidx.core.content.ContextCompat.getDrawable(this, appIconResId)
                if (drawable is android.graphics.drawable.BitmapDrawable) {
                    largeIconBitmap = drawable.bitmap
                } else if (drawable != null) {
                    val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 192
                    val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 192
                    largeIconBitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                    val canvas = android.graphics.Canvas(largeIconBitmap)
                    drawable.setBounds(0, 0, canvas.width, canvas.height)
                    drawable.draw(canvas)
                }
            } catch (e: Exception) {
                Log.e("EidonAlarm", "Failed to decode large icon", e)
            }
        }

        var notificationIconResId = 0
        try {
            val rClass = Class.forName("$packageName.R\$drawable")
            notificationIconResId = rClass.getField("notification_icon").getInt(null)
            Log.d("EidonAlarm", "Found notification_icon via reflection: $notificationIconResId")
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to find notification_icon via reflection", e)
            notificationIconResId = resources.getIdentifier("notification_icon", "drawable", packageName)
        }

        val notification = notificationBuilder
            .setContentTitle("Task Reminder")
            .setContentText("Tap to view your reminder")
            .setSmallIcon(if (notificationIconResId != 0) notificationIconResId else android.R.drawable.ic_dialog_info)
            .setLargeIcon(largeIconBitmap)
            .setCategory(Notification.CATEGORY_ALARM)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent) // Also allow tap-to-open
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC) // Show on lock screen
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // 4. Launch MainActivity only when the keyguard is not locked.
        //    Never bring the full app over the lock screen — that made the whole UI
        //    usable while the phone was still locked. Alarm sound/notification still run;
        //    fullScreenIntent delivers the high-priority notification on the lock screen.
        try {
            if (launchIntent != null) {
                val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                val isLocked = keyguardManager.isKeyguardLocked
                if (!isLocked) {
                    applicationContext.startActivity(launchIntent)
                    Log.d("EidonAlarm", "Launched MainActivity for alarm (device unlocked)")
                } else {
                    Log.d("EidonAlarm", "Skipped direct activity launch — keyguard locked")
                }
            }
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to directly launch activity", e)
        }

        // 5. Play Sound natively (Phase 1: sound 3, Phase 2: sound 2 after 60s)
        try {
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()

            // Phase 1: Play sound 3 once (no loop)
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(audioAttributes)
                val sound3ResId = resources.getIdentifier("notification_sound_3", "raw", packageName)
                if (sound3ResId != 0) {
                    val afd = resources.openRawResourceFd(sound3ResId)
                    setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                    afd.close()
                }
                isLooping = false
                prepare()
                start()
            }
            Log.d("EidonAlarm", "Playing Phase 1 alarm sound (sound 3)")

            // Phase 2: Schedule sound 2 to loop after 60 seconds
            phase2Handler = android.os.Handler(android.os.Looper.getMainLooper())
            phase2Runnable = Runnable {
                try {
                    mediaPlayer?.stop()
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(audioAttributes)
                        val sound2ResId = resources.getIdentifier("notification_sound_2", "raw", packageName)
                        if (sound2ResId != 0) {
                            val afd = resources.openRawResourceFd(sound2ResId)
                            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                            afd.close()
                        }
                        isLooping = true
                        setOnCompletionListener { start() }
                        prepare()
                        start()
                    }
                    Log.d("EidonAlarm", "Switched to Phase 2 alarm sound (sound 2 looped)")
                } catch (e: Exception) {
                    Log.e("EidonAlarm", "Failed to switch to Phase 2 sound", e)
                }
            }
            phase2Handler?.postDelayed(phase2Runnable!!, 60000)
            
        } catch (e: Exception) {
            Log.e("EidonAlarm", "Failed to play alarm sound", e)
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
                // The '0' in createWaveform(pattern, 0) means loop from index 0 of the pattern indefinitely.
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0) // '0' here also means repeat indefinitely
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
            phase2Runnable?.let { phase2Handler?.removeCallbacks(it) }
            phase2Handler = null
            phase2Runnable = null
        } catch (e: Exception) {}

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
                // Keep channel silent; we handle sound via MediaPlayer
                setSound(null, null)
                // Enable vibration for the alarm
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
