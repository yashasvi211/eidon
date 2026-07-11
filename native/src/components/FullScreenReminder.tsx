import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "../constants/theme";
import { Task } from "./DetailPanel";
import { NotificationData } from "./NotificationBanner";
import SwipeButton from "./sub_components/SwipeButton";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReminderPhase = "locked" | "details" | "acknowledge" | "reflect";

interface FullScreenReminderProps {
  visible: boolean;
  notification: NotificationData | null;
  task: Task | null;
  requireAuth: boolean;
  onDismiss: () => void;
  onComplete: (taskId: string, reflectionText: string) => void;
  colors: any;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtDateDisplay = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
};

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
  if (diffDays === 1) return "#f0883e";
  if (diffDays <= 2) return "#f0883e";
  return "#3fb950";
};

// ─── Component ─────────────────────────────────────────────────────────────────

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
  const { width, height } = useWindowDimensions();

  // ── State ──
  const [phase, setPhase] = useState<ReminderPhase>("locked");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reflectionText, setReflectionText] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // ── Audio Alarm ──
  const player = useAudioPlayer(
    require("../../assets/notification/notification_sound_1.mp3")
  );

  useEffect(() => {
    if (player) {
      player.loop = true;
    }
  }, [player]);

  // ── Animations ──
  const overlayOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const phaseProgress = useSharedValue(0);
  const authSuccessProgress = useSharedValue(0);

  // ── Clock tick ──
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // ── Start / stop alarm sound ──
  const startAlarmSound = useCallback(async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      player.play();
    } catch (err) {
      console.warn("Failed to play alarm sound:", err);
    }
  }, []);

  const stopAlarmSound = useCallback(() => {
    if (player) {
      player.pause();
    }
  }, [player]);

  // ── Modal lifecycle ──
  useEffect(() => {
    if (visible && notification) {
      // Reset state
      setPhase(requireAuth ? "locked" : "details");
      setReflectionText("");
      setIsAuthenticating(false);
      setAuthSuccess(false);
      authSuccessProgress.value = 0;
      phaseProgress.value = 0;

      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 400 });
      contentScale.value = withSpring(1, { damping: 22, stiffness: 200, mass: 0.8 });

      // Start alarm sound
      startAlarmSound();
    } else {
      // Animate out
      overlayOpacity.value = withTiming(0, { duration: 300 });
      contentScale.value = withTiming(0.9, { duration: 300 });
      stopAlarmSound();
    }

    return () => {
      stopAlarmSound();
    };
  }, [visible, notification]);

  // ── Phase transitions stop alarm ──
  useEffect(() => {
    if (phase !== "locked" && phase !== "details") {
      // Stop alarm when user starts interacting
      stopAlarmSound();
    }
  }, [phase]);

  // ── Authentication ──
  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to View Reminder",
          fallbackLabel: "Use PIN",
          disableDeviceFallback: false,
        });
        if (result.success) {
          setAuthSuccess(true);
          stopAlarmSound();
          authSuccessProgress.value = withSpring(1, {
            damping: 18,
            stiffness: 45,
            mass: 1.2,
          });
          setTimeout(() => {
            setPhase("details");
            setAuthSuccess(false);
            authSuccessProgress.value = 0;
          }, 1200);
        }
      } else {
        // No biometric — skip auth
        setAuthSuccess(true);
        stopAlarmSound();
        authSuccessProgress.value = withSpring(1, {
          damping: 18,
          stiffness: 45,
          mass: 1.2,
        });
        setTimeout(() => {
          setPhase("details");
          setAuthSuccess(false);
          authSuccessProgress.value = 0;
        }, 1200);
      }
    } catch (e) {
      console.warn("Authentication error:", e);
    }
    setIsAuthenticating(false);
  };

  const handleAcknowledge = () => {
    stopAlarmSound();
    setPhase("reflect");
  };

  // ── Submit reflection ──
  const handleSubmitReflection = () => {
    if (notification) {
      onComplete(notification.taskId, reflectionText.trim());
    }
  };

  const handleSkipReflection = () => {
    if (notification) {
      onComplete(notification.taskId, "");
    }
  };

  // ── Animated styles ──
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: overlayOpacity.value,
  }));

  const successCircleStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      authSuccessProgress.value,
      [0, 0.85, 1],
      [0.3, 1.05, 1],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }], opacity: authSuccessProgress.value };
  });

  const successLabelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      authSuccessProgress.value,
      [0.5, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      authSuccessProgress.value,
      [0.5, 1],
      [12, 0],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateY }] };
  });

  // ── Time display ──
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  const time12Str = `${hours12}:${String(minutes).padStart(2, "0")}`;

  const deadlineLabel = getDeadlineLabel(task?.due);
  const deadlineColor = getDeadlineColor(task?.due);

  if (!visible || !notification) return null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[styles.fullScreenOverlay, overlayAnimatedStyle]}>
          <Animated.View
            style={[
              styles.fullScreenContent,
              {
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 20,
              },
              contentAnimatedStyle,
            ]}
          >
            {/* ─── AUTH SUCCESS OVERLAY ─── */}
            {authSuccess && (
              <View style={styles.authSuccessOverlay}>
                <Animated.View style={[styles.authSuccessCircle, successCircleStyle]}>
                  <Feather name="check" size={42} color="#ffffff" />
                </Animated.View>
                <Animated.Text
                  style={[styles.authSuccessLabel, successLabelStyle]}
                >
                  Authenticated
                </Animated.Text>
              </View>
            )}

            {/* ─── PHASE: LOCKED ─── */}
            {phase === "locked" && !authSuccess && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                {/* Time */}
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>{time12Str}</Text>
                  <Text style={styles.ampmText}>{ampm}</Text>
                </View>

                {/* Reminder Label */}
                <View style={styles.reminderLabelRow}>
                  <View style={styles.bellPulse}>
                    <Feather name="bell" size={20} color="#58a6ff" />
                  </View>
                  <Text style={styles.reminderLabel}>Reminder</Text>
                </View>

                {/* Hidden content */}
                <View style={styles.hiddenContentBox}>
                  <Text style={styles.hiddenDots}>• • • • • • •</Text>
                  <Text style={styles.hiddenSubtext}>
                    Task details are hidden
                  </Text>
                </View>

                {/* Auth button */}
                <View style={styles.bottomAction}>
                  <TouchableOpacity
                    style={styles.authButton}
                    onPress={handleAuthenticate}
                    disabled={isAuthenticating}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="lock"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.authButtonText}>
                      {isAuthenticating
                        ? "Authenticating..."
                        : "Authenticate to View"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* ─── PHASE: DETAILS ─── */}
            {phase === "details" && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                {/* Time */}
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>{time12Str}</Text>
                  <Text style={styles.ampmText}>{ampm}</Text>
                </View>

                {/* Reminder Label */}
                <View style={styles.reminderLabelRow}>
                  <View style={styles.bellPulse}>
                    <Feather name="bell" size={20} color="#58a6ff" />
                  </View>
                  <Text style={styles.reminderLabel}>Reminder</Text>
                </View>

                {/* Task Details */}
                <View style={styles.detailsCard}>
                  <Text style={styles.taskTitle} numberOfLines={3}>
                    {task?.title || notification.taskTitle}
                  </Text>

                  {task?.due && (
                    <View style={styles.detailRow}>
                      <Feather name="calendar" size={14} color={deadlineColor} />
                      <Text style={[styles.detailText, { color: deadlineColor }]}>
                        {fmtDateDisplay(task.due)}
                        {task.dueTime ? ` at ${task.dueTime}` : ""}
                        {deadlineLabel ? ` · ${deadlineLabel}` : ""}
                      </Text>
                    </View>
                  )}

                  {task?.project && (
                    <View style={styles.detailRow}>
                      <Feather name="folder" size={14} color="#bc8cff" />
                      <Text style={[styles.detailText, { color: "#bc8cff" }]}>
                        {task.project}
                      </Text>
                    </View>
                  )}

                  {task?.notes && (
                    <View style={styles.notesSection}>
                      <Text style={styles.notesLabel}>Notes</Text>
                      <Text style={styles.notesText} numberOfLines={4}>
                        {task.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Continue button */}
                <View style={styles.bottomAction}>
                  <TouchableOpacity
                    style={styles.continueButton}
                    onPress={() => {
                      stopAlarmSound();
                      setPhase("acknowledge");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Feather name="chevron-right" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* ─── PHASE: ACKNOWLEDGE ─── */}
            {phase === "acknowledge" && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                <View style={styles.ackContent}>
                  <View style={styles.ackIconCircle}>
                    <Feather name="bell" size={32} color="#58a6ff" />
                  </View>
                  <Text style={styles.ackTitle}>Acknowledge Reminder</Text>
                  <Text style={styles.ackSubtitle} numberOfLines={2}>
                    {task?.title || notification.taskTitle}
                  </Text>
                </View>

                <View style={[styles.bottomAction, { paddingHorizontal: 32 }]}>
                  <SwipeButton
                    text="Slide to Acknowledge"
                    onSwipeSuccess={handleAcknowledge}
                    colors={{
                      ...colors,
                      ghSurface2: "rgba(255,255,255,0.08)",
                      ghBorder: "rgba(255,255,255,0.15)",
                      ghMuted: "rgba(255,255,255,0.5)",
                      ghBlue: "#58a6ff",
                    }}
                  />
                </View>
              </Animated.View>
            )}

            {/* ─── PHASE: REFLECT ─── */}
            {phase === "reflect" && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.phaseContainer}
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  style={styles.reflectContainer}
                >
                  <View style={styles.reflectContent}>
                    <View style={styles.reflectIconCircle}>
                      <Feather name="edit-3" size={28} color="#3fb950" />
                    </View>
                    <Text style={styles.reflectTitle}>
                      What's your plan?
                    </Text>
                    <Text style={styles.reflectSubtitle}>
                      A quick note to your future self.
                    </Text>

                    <TextInput
                      style={styles.reflectInput}
                      placeholder="e.g., I'll finish this after dinner..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={reflectionText}
                      onChangeText={setReflectionText}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      autoFocus
                    />
                  </View>

                  <View style={styles.reflectActions}>
                    <TouchableOpacity
                      style={[
                        styles.reflectSubmitBtn,
                        {
                          opacity: reflectionText.trim() ? 1 : 0.5,
                          backgroundColor: reflectionText.trim()
                            ? "#3fb950"
                            : "rgba(63, 185, 80, 0.3)",
                        },
                      ]}
                      onPress={handleSubmitReflection}
                      disabled={!reflectionText.trim()}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name="check"
                        size={18}
                        color="#ffffff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.reflectSubmitText}>Submit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reflectSkipBtn}
                      onPress={handleSkipReflection}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.reflectSkipText}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  fullScreenContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  phaseContainer: {
    flex: 1,
    justifyContent: "space-between",
  },

  // ── Time ──
  timeContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginTop: 24,
    gap: 8,
  },
  timeText: {
    fontSize: 64,
    fontWeight: "200",
    color: "#ffffff",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  ampmText: {
    fontSize: 20,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },

  // ── Reminder Label ──
  reminderLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 10,
  },
  bellPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(88, 166, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ── Locked Phase ──
  hiddenContentBox: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 12,
  },
  hiddenDots: {
    fontSize: 24,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 4,
  },
  hiddenSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },

  // ── Auth Button ──
  bottomAction: {
    paddingBottom: 16,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(88, 166, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(88, 166, 255, 0.3)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#58a6ff",
  },

  // ── Auth Success ──
  authSuccessOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  authSuccessCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3fb950",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3fb950",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  authSuccessLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 16,
  },

  // ── Details Phase ──
  detailsCard: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  taskTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 20,
    lineHeight: 34,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    fontWeight: "500",
  },
  notesSection: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },

  // ── Continue Button ──
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#58a6ff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },

  // ── Acknowledge Phase ──
  ackContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  ackIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(88, 166, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ackTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  ackSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // ── Reflect Phase ──
  reflectContainer: {
    flex: 1,
  },
  reflectContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  reflectIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(63, 185, 80, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reflectTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
  },
  reflectSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 24,
  },
  reflectInput: {
    width: "100%",
    minHeight: 100,
    maxHeight: 160,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "#ffffff",
    fontSize: 15,
    padding: 16,
    lineHeight: 22,
  },

  // ── Reflect Actions ──
  reflectActions: {
    paddingBottom: 16,
    gap: 12,
  },
  reflectSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  reflectSubmitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  reflectSkipBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  reflectSkipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
});
