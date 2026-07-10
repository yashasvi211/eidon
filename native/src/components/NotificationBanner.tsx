import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
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

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: colors.ghSurface,
          borderColor: colors.ghBlue,
          shadowColor: colors.ghBlue,
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
        activeOpacity={0.8}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.ghBlue + '20' }]}>
          <Feather name="bell" size={16} color={colors.ghBlue} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.ghText }]} numberOfLines={1}>
            {notification.taskTitle}
          </Text>
          <Text style={[styles.message, { color: colors.ghMuted }]} numberOfLines={1}>
            {notification.message}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dismissBtn, { backgroundColor: colors.ghSurface2 }]}
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={14} color={colors.ghMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10000,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 12,
    fontWeight: '400',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
