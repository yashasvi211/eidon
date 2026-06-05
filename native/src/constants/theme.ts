/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#24292f',
    background: '#ffffff',
    backgroundElement: '#f6f8fa',
    backgroundSelected: '#ddf4ff',
    textSecondary: '#57606a',
    ghBg: '#ffffff',
    ghSurface: '#f6f8fa',
    ghSurface2: '#eaeef2',
    ghBorder: '#d0d7de',
    ghBorder2: '#afb8c1',
    ghText: '#24292f',
    ghMuted: '#57606a',
    ghGreen: '#2da44e',
    ghBlue: '#0969da',
    ghPurple: '#8250df',
    ghAmber: '#bf8700',
    ghRed: '#cf222e',
  },
  dark: {
    text: '#e6edf3',
    background: '#0d1117',
    backgroundElement: '#161b22',
    backgroundSelected: '#21262d',
    textSecondary: '#8b949e',
    ghBg: '#0d1117',
    ghSurface: '#161b22',
    ghSurface2: '#21262d',
    ghBorder: '#30363d',
    ghBorder2: '#3d444d',
    ghText: '#e6edf3',
    ghMuted: '#8b949e',
    ghGreen: '#3fb950',
    ghBlue: '#58a6ff',
    ghPurple: '#bc8cff',
    ghAmber: '#d29922',
    ghRed: '#f85149',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
