import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface NotificationData {
  taskId: string;
  taskTitle: string;
  message: string;
  dueDate: string;
}

interface NotificationBannerProps {
  notification: NotificationData | null;
  onDismiss: () => void;
  onPress?: (taskId: string) => void;
}

const AUTO_DISMISS_MS = 8000;

export default function NotificationBanner({ notification, onDismiss, onPress }: NotificationBannerProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (notification) {
      // Slide in
      translateY.value = withSpring(0, { damping: 22, stiffness: 280, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-dismiss
      const timer = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    } else {
      translateY.value = -120;
      opacity.value = 0;
    }
  }, [notification]);

  const dismiss = () => {
    translateY.value = withTiming(-120, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!notification) return null;

  const isDark = scheme === 'dark';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 12,
          backgroundColor: isDark ? 'rgba(30, 35, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          shadowColor: '#000',
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => {
          if (onPress) onPress(notification.taskId);
          dismiss();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Image 
            source={require('../../assets/images/icon.png')} 
            style={[styles.iconCircle, { backgroundColor: colors.ghBlue + '15' }]} 
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.ghText }]} numberOfLines={1}>
            {notification.taskTitle}
          </Text>
          <Text style={[styles.message, { color: colors.ghMuted }]} numberOfLines={1}>
            {notification.message}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Swipe up indicator line at bottom */}
      <View style={styles.indicatorContainer}>
        <View style={[styles.indicatorLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10000,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 14,
    gap: 14,
  },
  iconContainer: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  indicatorContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  indicatorLine: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
