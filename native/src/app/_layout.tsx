import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RNStatusBar backgroundColor={colors.background} />
      <Slot />
    </SafeAreaProvider>
  );
}

