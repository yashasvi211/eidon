const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

const withAlarmManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add Permissions
    // Do NOT add DISABLE_KEYGUARD / showWhenLocked / turnScreenOn — those make the
    // whole MainActivity usable over the lock screen (not just during alarms).
    const permissionsToAdd = [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.VIBRATE',
    ];

    androidManifest['uses-permission'] = androidManifest['uses-permission'] || [];
    permissionsToAdd.forEach((permissionName) => {
      if (!androidManifest['uses-permission'].find((p) => p.$['android:name'] === permissionName)) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permissionName }
        });
      }
    });

    const application = androidManifest.application[0];

    // Add large icon for Expo Notifications (system banner).
    // NOTE: must point to a real bitmap (PNG) drawable, not an adaptive icon
    // (mipmap XML) — expo-notifications decodes the large icon via
    // BitmapFactory.decodeResource, which returns null for adaptive icon XML
    // and the app icon would be missing from the banner.
    application['meta-data'] = application['meta-data'] || [];
    const largeIconMeta = 'expo.modules.notifications.large_notification_icon';
    const largeIconRes = '@drawable/large_notification_icon';
    const existingLarge = application['meta-data'].find((m) => m.$['android:name'] === largeIconMeta);
    if (existingLarge) {
      existingLarge.$['android:resource'] = largeIconRes;
    } else {
      application['meta-data'].push({
        $: {
          'android:name': largeIconMeta,
          'android:resource': largeIconRes
        }
      });
    }

    // Add Receiver
    application.receiver = application.receiver || [];
    const receiverName = 'expo.modules.eidonalarm.AlarmReceiver';
    if (!application.receiver.find((r) => r.$['android:name'] === receiverName)) {
      application.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'false'
        }
      });
    }

    // Add Service
    application.service = application.service || [];
    const serviceName = 'expo.modules.eidonalarm.AlarmService';
    if (!application.service.find((s) => s.$['android:name'] === serviceName)) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'systemExempted'
        }
      });
    }

    // Explicitly clear any leftover lock-screen activity flags so prebuild cannot
    // leave MainActivity interactive while the device is locked.
    if (application.activity) {
      const mainActivity = application.activity.find((a) => a.$['android:name'] === '.MainActivity');
      if (mainActivity) {
        delete mainActivity.$['android:showWhenLocked'];
        delete mainActivity.$['android:turnScreenOn'];
      }
    }

    return config;
  });
};

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const withNativeAssets = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const rawDir = path.join(resDir, 'raw');

      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }

      const soundSource = path.join(projectRoot, 'assets', 'notification', 'notification_sound_1.mp3');
      const soundDest = path.join(rawDir, 'notification_sound_1.mp3');

      if (fs.existsSync(soundSource)) {
        fs.copyFileSync(soundSource, soundDest);
      } else {
        console.warn(`[expo-eidon-alarm] Warning: Sound file not found at ${soundSource}`);
      }

      // Copy the app icon into res/drawable as a real bitmap PNG so it can be
      // used as the expo-notifications large icon (BitmapFactory cannot decode
      // adaptive icon XML). Used by the banner drop-down notification.
      const drawableDir = path.join(resDir, 'drawable');
      if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
      }
      const iconSource = path.join(projectRoot, 'assets', 'images', 'icon.png');
      const iconDest = path.join(drawableDir, 'large_notification_icon.png');
      if (fs.existsSync(iconSource)) {
        fs.copyFileSync(iconSource, iconDest);
      } else {
        console.warn(`[expo-eidon-alarm] Warning: Icon file not found at ${iconSource}`);
      }

      return config;
    },
  ]);
};

module.exports = (config) => {
  config = withAlarmManifest(config);
  config = withNativeAssets(config);
  return config;
};
