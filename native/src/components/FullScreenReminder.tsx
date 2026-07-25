import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as EidonAlarm from "../../modules/expo-eidon-alarm";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { Task } from "./DetailPanel";
import { NotificationData } from "./NotificationBanner";
import SwipeButton from "./sub_components/SwipeButton";
import ConfirmationModal from "./sub_components/ConfirmationModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReminderPhase =
  | "countdown"           // Initial 60s — circle + STABILIZE / DEFER slides
  | "details"             // After STABILIZE — task details + response input
  | "uncontained"         // 60s expired — escalation stage, sound_2 plays
  | "uncontained_details"; // After STABILIZE in uncontained — response input

interface FullScreenReminderProps {
  visible: boolean;
  notification: NotificationData | null;
  task: Task | null;
  requireAuth: boolean;
  onDismiss: () => void;
  onComplete: (taskId: string, reflectionText: string) => void;
  colors: any;
}

// ─── Singleton guard — prevent two alarms from running at once ──────────────────
let _isAlarmActive = false;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getDeadlineLabel = (dueDate?: string) => {
  if (!dueDate) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due Today";
  if (diffDays === 1) return "Due Tomorrow";
  return `${diffDays}d left`;
};

const getDeadlineColor = (dueDate?: string) => {
  if (!dueDate) return "#8b949e";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "#f85149";
  if (diffDays === 0) return "#e3b341";
  if (diffDays <= 2) return "#f0883e";
  return "#3fb950";
};

// ─── Pulsing Countdown Circle ───────────────────────────────────────────────────
// A sleek glowing circle that pulses and shrinks slightly as time decreases.
// Replaces the arc approach to avoid clipping glitches.

function PulsingCountdownCircle({
  seconds,
  totalSeconds,
  color,
  size = 220,
}: {
  seconds: number;
  totalSeconds: number;
  color: string;
  size?: number;
}) {
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 0;
  
  // Outer glowing pulse
  const pulseAnim = useSharedValue(1);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: `${color}1A`,
    position: "absolute",
    transform: [{ scale: pulseAnim.value }],
  }));

  // Inner solid circle that shrinks with progress
  const innerScale = useSharedValue(progress);
  useEffect(() => {
    innerScale.value = withTiming(progress, { duration: 950, easing: Easing.linear });
  }, [progress]);

  const innerStyle = useAnimatedStyle(() => ({
    width: size * 0.9,
    height: size * 0.9,
    borderRadius: (size * 0.9) / 2,
    backgroundColor: `${color}33`,
    borderWidth: 2,
    borderColor: color,
    position: "absolute",
    transform: [{ scale: innerScale.value * 0.3 + 0.7 }], // Scale between 0.7 and 1.0
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={outerStyle} />
      <Animated.View style={innerStyle} />
      
      {/* Countdown number */}
      <Text
        style={{
          fontSize: size * 0.35,
          fontWeight: "300",
          color: "#ffffff",
          fontVariant: ["tabular-nums"],
          letterSpacing: -2,
          zIndex: 10,
        }}
      >
        {seconds}
      </Text>
    </View>
  );
}

// ─── Pixel-style Slide Button ──────────────────────────────────────────────────

interface PixelSlideButtonProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  label: string;
  trackColor: string;
  onSlideComplete: () => void;
}

function PixelSlideButton({
  icon,
  iconColor,
  iconBgColor,
  label,
  trackColor,
  onSlideComplete,
}: PixelSlideButtonProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const thumbSize = 52;
  const padding = 4;

  const panGesture = Gesture.Pan()
    .activeOffsetX([10, -10])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      const maxTranslate = Math.max(0, trackWidth - thumbSize - padding * 2);
      translateX.value = Math.max(
        0,
        Math.min(event.translationX, maxTranslate)
      );
    })
    .onEnd(() => {
      const maxTranslate = Math.max(0, trackWidth - thumbSize - padding * 2);
      if (translateX.value > maxTranslate * 0.75) {
        translateX.value = withSpring(maxTranslate, {
          damping: 24,
          stiffness: 300,
          mass: 0.7,
        }, (finished) => {
          if (finished) {
            runOnJS(onSlideComplete)();
          }
        });
      } else {
        translateX.value = withSpring(0, {
          damping: 24,
          stiffness: 300,
          mass: 0.7,
        });
      }
    });

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => {
    const maxTranslate = Math.max(1, trackWidth - thumbSize - padding * 2);
    return {
      opacity: interpolate(
        translateX.value,
        [0, maxTranslate * 0.5],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[slideStyles.track, { backgroundColor: trackColor }]}
    >
      <Animated.Text style={[slideStyles.label, animatedLabelStyle]}>
        {label}
      </Animated.Text>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            slideStyles.thumb,
            { backgroundColor: iconBgColor },
            animatedThumbStyle,
          ]}
        >
          <Feather name={icon as any} size={22} color={iconColor} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  track: {
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    marginBottom: 12,
  },
  label: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    marginLeft: 40,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 4,
    top: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

// ─── Sound Wave Bars ───────────────────────────────────────────────────────────

function SoundWaveIndicator() {
  const bar0 = useSharedValue(0);
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);
  const bar4 = useSharedValue(0);
  const delays = [0, 100, 200, 300, 150];

  useEffect(() => {
    const allBars = [bar0, bar1, bar2, bar3, bar4];
    allBars.forEach((bar, i) => {
      bar.value = withDelay(
        delays[i],
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    });
  }, []);

  const s0 = useAnimatedStyle(() => ({ height: interpolate(bar0.value, [0, 1], [8, 24], Extrapolation.CLAMP) }));
  const s1 = useAnimatedStyle(() => ({ height: interpolate(bar1.value, [0, 1], [8, 24], Extrapolation.CLAMP) }));
  const s2 = useAnimatedStyle(() => ({ height: interpolate(bar2.value, [0, 1], [8, 24], Extrapolation.CLAMP) }));
  const s3 = useAnimatedStyle(() => ({ height: interpolate(bar3.value, [0, 1], [8, 24], Extrapolation.CLAMP) }));
  const s4 = useAnimatedStyle(() => ({ height: interpolate(bar4.value, [0, 1], [8, 24], Extrapolation.CLAMP) }));

  const barBase = { width: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 24 }}>
      <Animated.View style={[barBase, s0]} />
      <Animated.View style={[barBase, s1]} />
      <Animated.View style={[barBase, s2]} />
      <Animated.View style={[barBase, s3]} />
      <Animated.View style={[barBase, s4]} />
    </View>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const COUNTDOWN_SECONDS = 60;
const UNCONTAINED_SOUND_SECONDS = 45;

// Audio sources
const sound3Source = require("../../assets/notification/notification_sound_3.mp3");
const sound2Source = require("../../assets/notification/notification_sound_2.mp3");

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FullScreenReminder({
  visible,
  notification,
  task,
  requireAuth,
  onDismiss,
  onComplete,
  colors,
}: FullScreenReminderProps) {
  const insets = useSafeAreaInsets();

  // ── State ──
  const [phase, setPhase] = useState<ReminderPhase>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [reflectionText, setReflectionText] = useState("");
  const [uncontainedCountdown, setUncontainedCountdown] = useState(UNCONTAINED_SOUND_SECONDS);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Refs ──
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uncontainedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Audio Players ──
  // Note: Sound playback is now 100% handled natively by AlarmService.kt
  // to ensure it survives the app being swiped away from recent apps.

  // ── Animations ──
  const overlayOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const pulseAnim = useSharedValue(1);

  // ── Back button: block hardware back during alarm ──
  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      // Block back button — alarm cannot be dismissed this way
      return true;
    });
    return () => handler.remove();
  }, [visible]);

  // ── Pulsing for uncontained stage ──
  useEffect(() => {
    if (phase === "uncontained") {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.94, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [phase]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // ── Stop all sounds ──
  const stopAllSounds = useCallback(() => {
    // Stop native alarm service sound & vibration
    if (Platform.OS === "android") {
      try { EidonAlarm.stopAlarm(); } catch (e) {}
    }
  }, []);

  // ── Modal lifecycle ──
  useEffect(() => {
    if (visible && notification) {
      // Duplicate guard
      if (_isAlarmActive) {
        setIsBlocked(true);
        return;
      }
      _isAlarmActive = true;
      setIsBlocked(false);

      // Reset all state for a fresh reminder
      setPhase("countdown");
      setCountdown(COUNTDOWN_SECONDS);
      setReflectionText("");
      setUncontainedCountdown(UNCONTAINED_SOUND_SECONDS);
      setShowConfirmModal(false);

      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 400 });
      contentScale.value = withSpring(1, { damping: 22, stiffness: 200, mass: 0.8 });

      // Play sound_3 natively handled by AlarmService.kt
      // No JS playback needed here.
      // Start 60s countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Animate out
      overlayOpacity.value = withTiming(0, { duration: 300 });
      contentScale.value = withTiming(0.9, { duration: 300 });

      // Cleanup
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (uncontainedTimerRef.current) {
        clearInterval(uncontainedTimerRef.current);
        uncontainedTimerRef.current = null;
      }
      stopAllSounds();
      _isAlarmActive = false;
    }

    return () => {
      // Always release the lock on unmount to prevent it getting stuck
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (uncontainedTimerRef.current) {
        clearInterval(uncontainedTimerRef.current);
        uncontainedTimerRef.current = null;
      }
      _isAlarmActive = false;
    };
  }, [visible, notification]);

  // ── Countdown reaches 0 → enter uncontained ──
  useEffect(() => {
    if (countdown === 0 && phase === "countdown") {
      setPhase("uncontained");
    }
  }, [countdown, phase]);

  // ── Enter uncontained — switch to sound_2 (looped) ──
  useEffect(() => {
    if (phase === "uncontained") {
      // Sound switch to looped phase 2 is handled natively by AlarmService.kt

      // Stop native alarm service (it was running sound_3 via the service)
      if (Platform.OS === "android") {
        try { EidonAlarm.stopAlarm(); } catch (e) {}
      }

      setUncontainedCountdown(UNCONTAINED_SOUND_SECONDS);
      uncontainedTimerRef.current = setInterval(() => {
        setUncontainedCountdown((prev) => {
          if (prev <= 1) {
            if (uncontainedTimerRef.current) clearInterval(uncontainedTimerRef.current);
            uncontainedTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (uncontainedTimerRef.current) {
        clearInterval(uncontainedTimerRef.current);
        uncontainedTimerRef.current = null;
      }
    };
  }, [phase]);

  // ── Handlers ──

  // STABILIZE CORE — move to details (sound keeps playing briefly until they type)
  const handleStabilizeCore = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Stop sound 3 when moving to details — they have acknowledged
    stopAllSounds();
    setPhase("details");
  }, [stopAllSounds]);

  // DEFER CONTAINMENT — stop everything, dismiss
  const handleDeferContainment = useCallback(() => {
    stopAllSounds();
    _isAlarmActive = false;
    if (notification) {
      onComplete(notification.taskId, "");
    }
  }, [stopAllSounds, notification, onComplete]);

  // Override — dismiss everything
  const handleOverride = useCallback(() => {
    stopAllSounds();
    _isAlarmActive = false;
    if (notification) {
      onComplete(notification.taskId, "");
    }
  }, [stopAllSounds, notification, onComplete]);

  // Submit response — show confirmation modal
  const handleSubmitResponse = useCallback(() => {
    if (!reflectionText.trim()) return;
    stopAllSounds();
    setShowConfirmModal(true);
  }, [reflectionText, stopAllSounds]);

  // Confirmed in modal — complete
  const handleConfirmed = useCallback(() => {
    _isAlarmActive = false;
    if (notification) {
      onComplete(notification.taskId, reflectionText.trim());
    }
  }, [notification, onComplete, reflectionText]);

  // Uncontained STABILIZE
  const handleUncontainedStabilize = useCallback(() => {
    if (uncontainedTimerRef.current) {
      clearInterval(uncontainedTimerRef.current);
      uncontainedTimerRef.current = null;
    }
    stopAllSounds();
    setPhase("uncontained_details");
  }, [stopAllSounds]);

  // ── Animated styles ──
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: overlayOpacity.value,
  }));

  const deadlineLabel = getDeadlineLabel(task?.due);
  const deadlineColor = getDeadlineColor(task?.due);

  if (!visible || !notification) return null;
  if (isBlocked) return null;

  // Current phase is details or uncontained_details
  const isDetailsPhase = phase === "details" || phase === "uncontained_details";
  const isUncontained = phase === "uncontained" || phase === "uncontained_details";

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        // Block hardware back — alarm cannot be dismissed this way
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[styles.fullScreenOverlay, overlayAnimatedStyle]}>
          <Animated.View
            style={[
              styles.fullScreenContent,
              {
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 20,
              },
              contentAnimatedStyle,
            ]}
          >

            {/* ──────────────────────────────────────────────────────────────── */}
            {/* PHASE: COUNTDOWN — 60s timer, sound_3 plays once               */}
            {/* ──────────────────────────────────────────────────────────────── */}
            {phase === "countdown" && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                {/* Header */}
                <View style={styles.topSection}>
                  <Text style={styles.mainTitle}>
                    Temporal containment breach detected
                  </Text>
                  <Text style={styles.mainSubtitle}>
                    Reminder core reaching criticality in
                  </Text>
                </View>

                {/* SVG Countdown Circle */}
                <View style={styles.centerSection}>
                    <PulsingCountdownCircle
                      seconds={countdown}
                      totalSeconds={COUNTDOWN_SECONDS}
                      color="#E8655A"
                    />
                  <SoundWaveIndicator />
                </View>

                {/* Slide Buttons */}
                <View style={styles.bottomSection}>
                  <PixelSlideButton
                    icon="shield"
                    iconColor="#1a1a1a"
                    iconBgColor="#C4C98E"
                    label="Stabilize Core"
                    trackColor="rgba(196, 201, 142, 0.18)"
                    onSlideComplete={handleStabilizeCore}
                  />
                  <PixelSlideButton
                    icon="clock"
                    iconColor="#1a1a1a"
                    iconBgColor="#E8655A"
                    label="Defer Containment"
                    trackColor="rgba(232, 101, 90, 0.18)"
                    onSlideComplete={handleDeferContainment}
                  />
                </View>
              </Animated.View>
            )}

            {/* ──────────────────────────────────────────────────────────────── */}
            {/* PHASE: UNCONTAINED — escalation, sound_2 loops                 */}
            {/* ──────────────────────────────────────────────────────────────── */}
            {phase === "uncontained" && (
              <Animated.View
                entering={FadeIn.duration(600)}
                style={styles.phaseContainer}
              >
                {/* Critical Warning Header */}
                <View style={styles.topSection}>
                  <Text style={styles.uncontainedTitle}>
                    TEMPORAL CONTAINMENT FAILURE
                  </Text>
                  <Text style={styles.uncontainedSubtitle}>
                    Critical threshold exceeded{"\n"}
                    Reminder has entered an uncontained state
                  </Text>
                </View>

                {/* Pulsing SVG Ring */}
                <View style={styles.centerSection}>
                  <Animated.View style={pulseStyle}>
                    <CountdownRing
                      seconds={uncontainedCountdown}
                      totalSeconds={UNCONTAINED_SOUND_SECONDS}
                      color="#FF4136"
                      size={220}
                    />
                  </Animated.View>
                  <SoundWaveIndicator />
                </View>

                {/* Slide buttons */}
                <View style={styles.bottomSection}>
                  <PixelSlideButton
                    icon="shield"
                    iconColor="#1a1a1a"
                    iconBgColor="#C4C98E"
                    label="Stabilize Core"
                    trackColor="rgba(196, 201, 142, 0.18)"
                    onSlideComplete={handleUncontainedStabilize}
                  />
                  <PixelSlideButton
                    icon="clock"
                    iconColor="#1a1a1a"
                    iconBgColor="#E8655A"
                    label="Defer Containment"
                    trackColor="rgba(232, 101, 90, 0.18)"
                    onSlideComplete={handleDeferContainment}
                  />
                </View>
              </Animated.View>
            )}

            {/* ──────────────────────────────────────────────────────────────── */}
            {/* PHASE: DETAILS / UNCONTAINED_DETAILS                           */}
            {/* Shows task info + response input + SwipeButton → ConfirmModal  */}
            {/* ──────────────────────────────────────────────────────────────── */}
            {isDetailsPhase && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  style={{ flex: 1, justifyContent: "space-between" }}
                >
                  {/* Header */}
                  <View style={styles.topSection}>
                    {phase === "uncontained_details" && (
                      <View style={styles.warningBadge}>
                        <Feather name="alert-triangle" size={14} color="#FF4136" />
                        <Text style={styles.warningBadgeText}>Uncontained</Text>
                      </View>
                    )}
                    <Text style={styles.phaseTitle}>
                      {task?.title || notification.taskTitle}
                    </Text>
                    {task?.due && (
                      <Text style={[styles.deadlineText, { color: deadlineColor }]}>
                        <Feather name="calendar" size={12} color={deadlineColor} />
                        {"  "}{deadlineLabel}
                      </Text>
                    )}
                  </View>

                  {/* Response Input */}
                  <View style={styles.respondCenter}>
                    <View style={styles.respondIconCircle}>
                      <Feather
                        name="edit-3"
                        size={26}
                        color={phase === "uncontained_details" ? "#FF4136" : "#3fb950"}
                      />
                    </View>
                    <Text style={styles.respondTitle}>What's your plan?</Text>
                    <Text style={styles.respondSubtitle}>
                      A quick note to your future self
                    </Text>

                    <TextInput
                      style={[
                        styles.respondInput,
                        phase === "uncontained_details" && {
                          borderColor: "rgba(255, 65, 54, 0.3)",
                        },
                      ]}
                      placeholder="e.g., I'll finish this after dinner..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={reflectionText}
                      onChangeText={setReflectionText}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      multiline
                      autoFocus
                    />
                  </View>

                  {/* Submit via SwipeButton */}
                  <View style={styles.bottomSection}>
                    <SwipeButton
                      text="Swipe to Submit Response"
                      onSwipeSuccess={handleSubmitResponse}
                      colors={{
                        ghBlue: phase === "uncontained_details" ? "#FF4136" : "#3fb950",
                        ghSurface2: phase === "uncontained_details"
                          ? "rgba(255, 65, 54, 0.1)"
                          : "rgba(63, 185, 80, 0.1)",
                        ghBorder: phase === "uncontained_details"
                          ? "rgba(255, 65, 54, 0.3)"
                          : "rgba(63, 185, 80, 0.3)",
                        ghMuted: "rgba(255,255,255,0.6)",
                        ghText: "#ffffff",
                      }}
                      disabled={!reflectionText.trim()}
                    />

                    <Text
                      style={styles.overrideLink}
                      onPress={handleOverride}
                    >
                      Override — skip without notes
                    </Text>
                  </View>
                </KeyboardAvoidingView>
              </Animated.View>
            )}

          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>

      {/* ── Confirmation Modal — shown after swipe ── */}
      <ConfirmationModal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmed}
        title="Submit Response"
        description={`Log your response for:\n"${task?.title || notification?.taskTitle || ""}"`}
        colors={colors}
        successText="Response Logged!"
      />
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  fullScreenContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  phaseContainer: {
    flex: 1,
    justifyContent: "space-between",
  },

  // ── Top ──
  topSection: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  mainSubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },

  // ── Center ──
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Bottom ──
  bottomSection: {
    paddingBottom: 8,
  },

  // ── Phase title (details screen) ──
  phaseTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  deadlineText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },

  // ── Respond (details phase) ──
  respondCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  respondIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(63, 185, 80, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  respondTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  respondSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 20,
  },
  respondInput: {
    width: "100%",
    minHeight: 110,
    maxHeight: 160,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    color: "#ffffff",
    fontSize: 15,
    padding: 16,
    lineHeight: 22,
    textAlignVertical: "top",
  },

  // ── Override link ──
  overrideLink: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.3)",
    marginTop: 14,
    paddingVertical: 4,
  },

  // ── Uncontained ──
  uncontainedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FF4136",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  uncontainedSubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.6)",
    marginTop: 6,
    lineHeight: 22,
  },

  // ── Warning Badge ──
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 65, 54, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  warningBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF4136",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
