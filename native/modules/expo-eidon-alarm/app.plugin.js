const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

const withAlarmManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add Permissions
    const permissionsToAdd = [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
      'android.permission.DISABLE_KEYGUARD',
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

    // Update MainActivity flags for full screen intent (showWhenLocked, turnScreenOn)
    if (application.activity) {
      const mainActivity = application.activity.find((a) => a.$['android:name'] === '.MainActivity');
      if (mainActivity) {
        mainActivity.$['android:showWhenLocked'] = 'true';
        mainActivity.$['android:turnScreenOn'] = 'true';
      }
    }

    return config;
  });
};

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const withAlarmSound = (config) => {
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

      return config;
    },
  ]);
};

module.exports = (config) => {
  config = withAlarmManifest(config);
  config = withAlarmSound(config);
  return config;
};
