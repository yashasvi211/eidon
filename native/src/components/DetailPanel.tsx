import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather, Octicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

// Pull-down dismiss threshold: if user drags past this many pixels, we close
const DISMISS_THRESHOLD = 120;
// Spring config for buttery-smooth native-thread animations
const OPEN_SPRING = { damping: 28, stiffness: 220, mass: 0.9 };
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.7 };
const EXIT_DURATION = 250;
const EXIT_EASING = Easing.bezierFn(0.4, 0, 1, 1);

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Session {
  id: string;
  start: number;
  end: number;
  note?: string;
  subtasksCompleted?: string[];
}

export interface AuditEntry {
  id?: string;
  timestamp: number;
  action:
    | "created"
    | "completed"
    | "uncompleted"
    | "due_changed"
    | "estimate_changed"
    | "timer_started"
    | "timer_stopped"
    | "subtask_completed"
    | "subtask_uncompleted"
    | "subtask_added";
  details?: {
    subtaskTitle?: string;
    oldDue?: string;
    newDue?: string;
    oldEst?: string;
    newEst?: string;
    note?: string;
  };
}

export interface TaskReminder {
  remindBefore: number;       // ms before due date to start reminding
  repeatEvery?: number;       // ms between repeat notifications (optional)
  lastNotifiedAt?: number;    // timestamp of last notification fired
  dismissed?: boolean;        // user dismissed all reminders for this task
}

export interface Task {
  id: string;
  title: string;
  project: string;
  done: boolean;
  target: string;
  est?: string;
  due?: string;
  dueTime?: string;
  notes?: string;
  subtasks?: Subtask[];
  sessions?: Session[];
  createdAt?: number;
  completedAt?: number | null;
  auditLog?: AuditEntry[];
  reminder?: TaskReminder;
}

interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
  onToggleDone: (id: string) => void;
  onUpdateTask: (updated: Task) => void;
  isTimerRunning: boolean;
  timerSeconds: number;
  onStartTimer: (id: string) => void;
  onStopTimer: (note: string) => void;
  activeTimerTaskId: string | null;
  activeTab?: "details" | "checklist" | "timetracking" | "history";
  setActiveTab?: (tab: "details" | "checklist" | "timetracking" | "history") => void;
}

const fmtDateDisplay = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
};

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtTimer = (s: number) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const fmtRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

interface AuditIconConfig {
  iconName: string;
  library: "Feather" | "Octicons";
  label: string;
  color: string;
}

const AUDIT_ICONS: {
  [key: string]: AuditIconConfig;
} = {
  created: { iconName: "plus", library: "Feather", label: "Task created", color: "#3fb950" },
  completed: { iconName: "check-circle", library: "Feather", label: "Task completed", color: "#3fb950" },
  uncompleted: { iconName: "rotate-ccw", library: "Feather", label: "Task reopened", color: "#f0883e" },
  due_changed: { iconName: "calendar", library: "Feather", label: "Due date changed", color: "#58a6ff" },
  estimate_changed: { iconName: "clock", library: "Feather", label: "Estimate updated", color: "#d29922" },
  timer_started: { iconName: "play", library: "Feather", label: "Timer started", color: "#3fb950" },
  timer_stopped: { iconName: "square", library: "Feather", label: "Timer stopped", color: "#f85149" },
  subtask_completed: {
    iconName: "check-square",
    library: "Feather",
    label: "Subtask completed",
    color: "#3fb950",
  },
  subtask_uncompleted: {
    iconName: "square",
    library: "Feather",
    label: "Subtask reopened",
    color: "#f0883e",
  },
  subtask_added: { iconName: "plus-square", library: "Feather", label: "Subtask added", color: "#58a6ff" },
};

const SwipeStartButton = ({
  onSwipeSuccess,
  colors,
  disabled,
}: {
  onSwipeSuccess: () => void;
  colors: any;
  disabled: boolean;
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const thumbWidth = 46;

  const onLayout = (e: any) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([5, -5])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      const maxTranslate = Math.max(0, trackWidth - thumbWidth - 4);
      translateX.value = Math.max(
        0,
        Math.min(event.translationX, maxTranslate)
      );
    })
    .onEnd(() => {
      const maxTranslate = Math.max(0, trackWidth - thumbWidth - 4);
      if (translateX.value > maxTranslate * 0.8) {
        translateX.value = withSpring(maxTranslate, SNAP_SPRING, (finished) => {
          if (finished) {
            runOnJS(onSwipeSuccess)();
            translateX.value = withTiming(0, { duration: 250 });
          }
        });
      } else {
        translateX.value = withSpring(0, SNAP_SPRING);
      }
    });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const animatedTrackStyle = useAnimatedStyle(() => {
    const maxTranslate = Math.max(1, trackWidth - thumbWidth - 4);
    const opacity = interpolate(
      translateX.value,
      [0, maxTranslate * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.swipeTrack,
        {
          backgroundColor: colors.ghSurface2,
          borderColor: colors.ghBorder,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Animated.Text
        style={[
          styles.swipeText,
          { color: colors.ghMuted },
          animatedTrackStyle,
        ]}
      >
        Swipe to start timer
      </Animated.Text>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.swipeThumb,
            { backgroundColor: colors.ghBlue },
            animatedThumbStyle,
          ]}
        >
          <Feather name="chevrons-right" size={20} color="#ffffff" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const getDeadlineInfo = (dueDate?: string, colors?: any) => {
  if (!dueDate)
    return { color: colors.ghText, label: "", dotColor: "transparent" };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return {
      color: "#f85149",
      label: `${Math.abs(diffDays)}d overdue`,
      dotColor: "#f85149",
    };
  if (diffDays === 0)
    return { color: "#e3b341", label: "Due today!", dotColor: "#e3b341" };
  if (diffDays === 1)
    return { color: "#f0883e", label: "Due tomorrow", dotColor: "#f0883e" };
  if (diffDays <= 2)
    return {
      color: "#f0883e",
      label: `${diffDays}d left`,
      dotColor: "#f0883e",
    };
  if (diffDays <= 7)
    return {
      color: "#d29922",
      label: `${diffDays}d left`,
      dotColor: "#d29922",
    };
  return { color: "#3fb950", label: `${diffDays}d left`, dotColor: "#3fb950" };
};

const getSubtaskProgressInfo = (done: number, total: number, colors: any) => {
  if (total === 0) return { color: colors.ghMuted, pct: 0 };
  const pct = Math.round((done / total) * 100);
  let color = colors.ghMuted;
  if (pct === 0) color = "#f85149";
  else if (pct < 40) color = "#f0883e";
  else if (pct < 70) color = "#d29922";
  else if (pct < 100) color = "#56d4dd";
  else color = "#3fb950";
  return { color, pct };
};

export default function DetailPanel({
  task,
  onClose,
  onToggleDone,
  onUpdateTask,
  isTimerRunning,
  timerSeconds,
  onStartTimer,
  onStopTimer,
  activeTimerTaskId,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}: DetailPanelProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [localActiveTab, setLocalActiveTab] = useState<
    "details" | "checklist" | "timetracking" | "history"
  >("details");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;

  const [tabBarWidth, setTabBarWidth] = useState(isLargeScreen ? 0 : width);

  const handleTabBarLayout = (e: any) => {
    setTabBarWidth(e.nativeEvent.layout.width);
  };

  const TABS = ["details", "checklist", "timetracking", "history"] as const;
  const activeIndex = TABS.indexOf(activeTab);

  // Scroll and touch references
  const scrollViewRef = useRef<any>(null);

  // --- Bottom-to-top slide animation (mobile only) ---
  // translateY drives the vertical offset; 0 = fully open, height = fully hidden below
  const translateY = useSharedValue(isLargeScreen ? 0 : height);
  const dragY = useSharedValue(0);

  // Entrance animation: slide up from bottom using spring for butter-smooth 60fps
  useEffect(() => {
    if (!isLargeScreen) {
      translateY.value = withSpring(0, OPEN_SPRING);
    }
  }, [isLargeScreen]);

  // Pull-down-to-close pan gesture (mobile only)
  // - activeOffsetY: only activate after 10px vertical movement
  // - failOffsetX: cancel if horizontal movement exceeds 15px (let ScrollView handle it)
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY([10, -10])
      .failOffsetX([-15, 15])
      .onUpdate((e) => {
        // Only allow dragging downward (positive translationY)
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
          // Dismiss: animate down off-screen
          translateY.value = withTiming(height, {
            duration: EXIT_DURATION,
            easing: EXIT_EASING,
          }, () => {
            runOnJS(onClose)();
          });
          dragY.value = withTiming(0, { duration: EXIT_DURATION });
        } else {
          // Snap back
          dragY.value = withSpring(0, SNAP_SPRING);
        }
      });
  }, [height, onClose]);

  // Horizontal scroll for tab swiping (mobile)
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  }, []);

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const tabWidth = tabBarWidth / 4;
    if (tabBarWidth === 0) {
      return { left: 0, width: tabWidth };
    }
    if (isLargeScreen) {
      const leftPos = activeIndex * tabWidth;
      return { left: leftPos, width: tabWidth };
    }
    const leftPos = Math.max(0, Math.min(scrollX.value / 4, tabWidth * 3));
    return {
      left: leftPos,
      width: tabWidth,
    };
  }, [tabBarWidth, isLargeScreen, activeIndex]);

  // Root container style: slide up/down
  const rootAnimatedStyle = useAnimatedStyle(() => {
    if (isLargeScreen) return {};
    return {
      transform: [{ translateY: translateY.value + dragY.value }],
      opacity: interpolate(
        translateY.value + dragY.value,
        [0, height * 0.5],
        [1, 0.85],
        Extrapolation.CLAMP,
      ),
    };
  }, [isLargeScreen, height]);

  // Synchronize ScrollView offset when activeTab changes
  useEffect(() => {
    const index = TABS.indexOf(activeTab);
    if (scrollViewRef.current && tabBarWidth > 0 && !isLargeScreen) {
      scrollViewRef.current.scrollTo({
        x: index * tabBarWidth,
        animated: true,
      });
    }
  }, [activeTab, tabBarWidth, isLargeScreen]);

  // Handle horizontal swipe momentum settling on a page
  const handleScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / tabBarWidth);

    if (pageIndex >= 0 && pageIndex < TABS.length) {
      const targetTab = TABS[pageIndex];
      if (targetTab !== activeTab) {
        setActiveTab(targetTab);
      }
    }
  };

  // Reset tab and scroll position on task change
  useEffect(() => {
    setActiveTab("details");
    setSessionNote("");
    if (scrollViewRef.current && tabBarWidth > 0) {
      scrollViewRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [task?.id, tabBarWidth, isLargeScreen]);

  const handleClose = () => {
    if (isLargeScreen) {
      onClose();
      return;
    }
    translateY.value = withTiming(
      height,
      { duration: EXIT_DURATION, easing: EXIT_EASING },
      () => {
        runOnJS(onClose)();
      }
    );
  };

  if (!task) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: colors.ghBg,
            borderLeftColor: colors.ghBorder,
            borderLeftWidth: isLargeScreen ? 1 : 0,
          },
        ]}
      >
        <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
          Select a task to view details
        </Text>
      </View>
    );
  }

  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter((s) => s.done).length;
  const totalSubtasks = subtasks.length;
  const progress = getSubtaskProgressInfo(subtasksDone, totalSubtasks, colors);

  const dlInfo = getDeadlineInfo(task.due, colors);
  const isThisTaskTimerRunning =
    isTimerRunning && activeTimerTaskId === task.id;

  const handleToggleSubtask = (subId: string) => {
    const updatedSubtasks = subtasks.map((s) => {
      if (s.id !== subId) return s;
      const isDone = !s.done;

      // Add audit entry
      const auditEntry: AuditEntry = {
        timestamp: Date.now(),
        action: isDone ? "subtask_completed" : "subtask_uncompleted",
        details: { subtaskTitle: s.title },
      };

      return { ...s, done: isDone };
    });

    // Generate new audit log entry
    const isDoneNow = updatedSubtasks.find((s) => s.id === subId)?.done;
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: isDoneNow ? "subtask_completed" : "subtask_uncompleted",
      details: { subtaskTitle: subtasks.find((s) => s.id === subId)?.title },
    };

    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
      auditLog: [...(task.auditLog || []), audit],
    });
  };

  const handleStartTimerAuthentication = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to start task timer",
          fallbackLabel: "Use Password/PIN",
          disableDeviceFallback: false,
        });
        if (result.success) {
          onStartTimer(task.id);
        }
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to start task timer",
          disableDeviceFallback: false,
        });
        if (result.success) {
          onStartTimer(task.id);
        }
      }
    } catch (e) {
      console.warn("LocalAuthentication error, starting timer directly:", e);
      onStartTimer(task.id);
    }
  };

  const handleAddSubtaskSubmit = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: Subtask = {
      id: "s" + Date.now(),
      title: newSubtaskTitle.trim(),
      done: false,
    };
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "subtask_added",
      details: { subtaskTitle: newSub.title },
    };

    onUpdateTask({
      ...task,
      subtasks: [...subtasks, newSub],
      auditLog: [...(task.auditLog || []), audit],
    });
    setNewSubtaskTitle("");
  };

  // The drag-handle + header area that responds to pull-down gesture
  const dragArea = (
    <>
      {/* Drag handle indicator (mobile only) */}
      {!isLargeScreen && (
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.ghBorder2 }]} />
        </View>
      )}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.ghBorder }]}>
        <Text
          style={[styles.headerTitle, { color: colors.ghText }]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={{ color: colors.ghMuted, fontSize: 20 }}>×</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const panelContent = (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.ghBg,
          borderLeftColor: colors.ghBorder,
          borderLeftWidth: isLargeScreen ? 1 : 0,
          borderTopLeftRadius: isLargeScreen ? 0 : 16,
          borderTopRightRadius: isLargeScreen ? 0 : 16,
        },
        rootAnimatedStyle,
      ]}
    >
      {/* On mobile, wrap drag area with GestureDetector for pull-down-to-close */}
      {!isLargeScreen ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View>{dragArea}</Animated.View>
        </GestureDetector>
      ) : (
        dragArea
      )}

      {/* Tabs */}
      <View
        style={[
          styles.tabsRow,
          {
            borderBottomColor: colors.ghBorder,
            backgroundColor: colors.ghSurface,
          },
        ]}
        onLayout={handleTabBarLayout}
      >
        {(["details", "checklist", "timetracking", "history"] as const).map(
          (tab) => {
            const isActive = activeTab === tab;
            let label = tab.charAt(0).toUpperCase() + tab.slice(1);
            if (tab === "timetracking") label = "Time";
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: isActive ? colors.ghText : colors.ghMuted },
                  ]}
                >
                  {label}
                  {tab === "checklist" &&
                    totalSubtasks > 0 &&
                    ` (${subtasksDone}/${totalSubtasks})`}
                </Text>
              </TouchableOpacity>
            );
          },
        )}
        {tabBarWidth > 0 && (
          <Animated.View
            style={[
              styles.tabIndicatorContainer,
              indicatorAnimatedStyle,
            ]}
          >
            <View style={[styles.tabIndicatorInner, { backgroundColor: colors.ghBlue }]} />
          </Animated.View>
        )}
      </View>

      {/* Tab Content */}
      <TabContentContainer
        isLargeScreen={isLargeScreen}
        scrollViewRef={scrollViewRef}
        scrollHandler={scrollHandler}
        handleScrollEnd={handleScrollEnd}
        tabBarWidth={tabBarWidth}
      >
        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="details"
          tabBarWidth={tabBarWidth}
        >
            <View style={styles.detailSection}>
              <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                STATUS
              </Text>
              <TouchableOpacity
                onPress={() => onToggleDone(task.id)}
                style={styles.statusToggle}
              >
                <View
                  style={[
                    styles.statusCircle,
                    {
                      borderColor: task.done
                        ? colors.ghGreen
                        : colors.ghBorder2,
                      backgroundColor: task.done
                        ? colors.ghGreen
                        : "transparent",
                    },
                  ]}
                >
                  {task.done && (
                    <Text style={{ color: "#fff", fontSize: 10 }}>✓</Text>
                  )}
                </View>
                <Text
                  style={{
                    color: task.done ? colors.ghGreen : colors.ghText,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {task.done ? "Completed" : "In Progress"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                PROJECT
              </Text>
              <Text
                style={[
                  styles.tag,
                  {
                    color: colors.ghPurple,
                    backgroundColor: "rgba(188, 140, 255, 0.08)",
                    borderColor: "rgba(188, 140, 255, 0.3)",
                    alignSelf: "flex-start",
                  },
                ]}
              >
                {task.project}
              </Text>
            </View>

            {task.est ? (
              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  ESTIMATE
                </Text>
                <Text
                  style={{
                    color: colors.ghText,
                    fontFamily: "monospace",
                    fontSize: 13,
                  }}
                >
                  {task.est}
                </Text>
              </View>
            ) : null}

            {task.due ? (
              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  DUE DATE
                </Text>
                <View style={styles.dueRow}>
                  <View
                    style={[
                      styles.dueDot,
                      { backgroundColor: dlInfo.dotColor },
                    ]}
                  />
                  <Text
                    style={{
                      color: dlInfo.color,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    {fmtDateDisplay(task.due)}{" "}
                    {dlInfo.label && `(${dlInfo.label})`}
                  </Text>
                </View>
              </View>
            ) : null}

            {task.notes ? (
              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  NOTES
                </Text>
                <Text style={[styles.notesText, { color: colors.ghText }]}>
                  {task.notes}
                </Text>
              </View>
            ) : null}

            {/* Timer Tracking Block */}
            <View
              style={[
                styles.timerBlock,
                {
                  backgroundColor: colors.ghSurface,
                  borderColor: colors.ghBorder,
                },
              ]}
            >
              {isThisTaskTimerRunning ? (
                <View style={styles.timerRunningRow}>
                  <View style={styles.timerTimerLabel}>
                    <View
                      style={[
                        styles.pulseDot,
                        { backgroundColor: colors.ghGreen },
                      ]}
                    />
                    <Text
                      style={[styles.timerClockText, { color: colors.ghText }]}
                    >
                      {fmtTimer(timerSeconds)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <TextInput
                      style={[
                        styles.sessionNoteInput,
                        {
                          color: colors.ghText,
                          borderColor: colors.ghBorder,
                          backgroundColor: colors.ghSurface2,
                        },
                      ]}
                      placeholder="Note for session..."
                      placeholderTextColor={colors.ghMuted}
                      value={sessionNote}
                      onChangeText={setSessionNote}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.timerBtn, { backgroundColor: colors.ghRed }]}
                    onPress={() => onStopTimer(sessionNote)}
                  >
                    <Text style={styles.timerBtnText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
                    No active session.
                  </Text>
                  <SwipeStartButton
                    colors={colors}
                    disabled={isTimerRunning && activeTimerTaskId !== task.id}
                    onSwipeSuccess={handleStartTimerAuthentication}
                  />
                </View>
              )}
              {isTimerRunning && activeTimerTaskId !== task.id && (
                <Text style={[styles.timerWarning, { color: colors.ghAmber }]}>
                  Another task timer is currently active.
                </Text>
              )}
            </View>
          </TabPage>

        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="checklist"
          tabBarWidth={tabBarWidth}
        >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressInfo}>
                <Text style={[styles.progressLabel, { color: colors.ghMuted }]}>
                  SUBTASK COMPLETION
                </Text>
                <Text style={[styles.progressValue, { color: progress.color }]}>
                  {progress.pct}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.ghBorder },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: progress.color,
                      width: `${progress.pct}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Checklist */}
            <View style={styles.checklist}>
              {subtasks.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.checkItem,
                    { borderBottomColor: colors.ghBorder },
                  ]}
                  onPress={() => handleToggleSubtask(sub.id)}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      {
                        borderColor: sub.done
                          ? colors.ghGreen
                          : colors.ghBorder2,
                        backgroundColor: sub.done
                          ? colors.ghGreen
                          : "transparent",
                      },
                    ]}
                  >
                    {sub.done && (
                      <Octicons name="check" size={10} color="#ffffff" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.checkText,
                      { color: sub.done ? colors.ghMuted : colors.ghText },
                      sub.done && styles.lineThrough,
                    ]}
                  >
                    {sub.title}
                  </Text>
                </TouchableOpacity>
              ))}

              {subtasks.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.ghMuted }]}>
                  No subtasks added yet.
                </Text>
              )}
            </View>

            {/* Add subtask */}
            <View style={styles.addSubtaskBox}>
              <TextInput
                style={[
                  styles.subtaskInput,
                  {
                    color: colors.ghText,
                    backgroundColor: colors.ghSurface2,
                    borderColor: colors.ghBorder,
                  },
                ]}
                placeholder="Add subtask..."
                placeholderTextColor={colors.ghMuted}
                value={newSubtaskTitle}
                onChangeText={setNewSubtaskTitle}
                onSubmitEditing={handleAddSubtaskSubmit}
              />
              <TouchableOpacity
                style={[
                  styles.addSubtaskBtn,
                  {
                    backgroundColor: newSubtaskTitle.trim()
                      ? colors.ghBlue
                      : colors.ghSurface2,
                    borderColor: colors.ghBorder,
                    borderWidth: 1,
                  },
                ]}
                onPress={handleAddSubtaskSubmit}
                disabled={!newSubtaskTitle.trim()}
              >
                <Octicons
                  name="plus"
                  size={14}
                  color={newSubtaskTitle.trim() ? "#ffffff" : colors.ghMuted}
                />
              </TouchableOpacity>
            </View>
          </TabPage>

        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="timetracking"
          tabBarWidth={tabBarWidth}
        >
            <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
              LOGGED SESSIONS
            </Text>
            {!task.sessions || task.sessions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.ghMuted }]}>
                No time has been logged on this task.
              </Text>
            ) : (
              <View style={styles.sessionsList}>
                {task.sessions.map((sess) => {
                  const duration = (sess.end - sess.start) / 1000;
                  const startStr = new Date(sess.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endStr = new Date(sess.end).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const dateStr = new Date(sess.start).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <View
                      key={sess.id}
                      style={[
                        styles.sessionCard,
                        {
                          backgroundColor: colors.ghSurface,
                          borderColor: colors.ghBorder,
                        },
                      ]}
                    >
                      <View style={styles.sessionHeaderRow}>
                        <Text
                          style={[styles.sessionDate, { color: colors.ghText }]}
                        >
                          {dateStr}
                        </Text>
                        <Text
                          style={[
                            styles.sessionDuration,
                            { color: colors.ghBlue },
                          ]}
                        >
                          {fmtSeconds(duration)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.sessionTimes, { color: colors.ghMuted }]}
                      >
                        {startStr} — {endStr}
                      </Text>
                      {sess.note ? (
                        <Text
                          style={[styles.sessionNote, { color: colors.ghText }]}
                        >
                          "{sess.note}"
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </TabPage>

        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="history"
          tabBarWidth={tabBarWidth}
        >
            <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
              AUDIT LOG TIMELINE
            </Text>
            {!task.auditLog || task.auditLog.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.ghMuted }]}>
                No actions recorded.
              </Text>
            ) : (
              <View style={styles.timelineContainer}>
                {/* Vertical line connecting nodes */}
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: colors.ghBorder },
                  ]}
                />

                {task.auditLog.map((entry, idx) => {
                  const info = AUDIT_ICONS[entry.action] || {
                    iconName: "edit",
                    library: "Feather",
                    label: "Task updated",
                    color: colors.ghMuted,
                  };
                  let detailsText = "";

                  if (
                    entry.action === "subtask_completed" ||
                    entry.action === "subtask_uncompleted" ||
                    entry.action === "subtask_added"
                  ) {
                    detailsText = `"${entry.details?.subtaskTitle}"`;
                  } else if (
                    entry.action === "timer_stopped" &&
                    entry.details?.note
                  ) {
                    detailsText = `Note: "${entry.details.note}"`;
                  } else if (entry.action === "due_changed") {
                    detailsText = `to ${fmtDateDisplay(entry.details?.newDue)}`;
                  }

                  return (
                    <View key={idx} style={styles.timelineNode}>
                      <View
                        style={[
                          styles.nodeIconCircle,
                          {
                            backgroundColor: colors.ghBg,
                            borderColor: info.color || colors.ghBorder,
                          },
                        ]}
                      >
                        {info.library === "Octicons" ? (
                          <Octicons name={info.iconName as any} size={11} color={info.color} />
                        ) : (
                          <Feather name={info.iconName as any} size={11} color={info.color} />
                        )}
                      </View>

                      <View style={styles.nodeContent}>
                        <Text
                          style={[styles.nodeTitle, { color: colors.ghText }]}
                        >
                          {info.label}{" "}
                          <Text
                            style={{ color: colors.ghMuted, fontWeight: "400" }}
                          >
                            {detailsText}
                          </Text>
                        </Text>
                        <Text
                          style={[styles.nodeTime, { color: colors.ghMuted }]}
                        >
                          {fmtRelativeTime(entry.timestamp)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </TabPage>
      </TabContentContainer>
    </Animated.View>
  );

  return panelContent;
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    borderLeftWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    borderLeftWidth: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  dragHandleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 10,
  },
  closeBtn: {
    padding: 5,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabButtonActive: {
    // optional styling
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
  },
  tabIndicatorContainer: {
    position: "absolute",
    bottom: 0,
    height: 2,
  },
  tabIndicatorInner: {
    flex: 1,
    marginHorizontal: 8,
    height: 2,
  },
  scrollContent: {
    flex: 1,
  },
  tabSection: {
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tag: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 12,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  timerBlock: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  timerIdleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerRunningRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  timerTimerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timerClockText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  sessionNoteInput: {
    height: 28,
    borderWidth: 1,
    borderRadius: 4,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  timerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 0,
  },
  timerBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  timerWarning: {
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: "700",
  },
  progressValue: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  checklist: {
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 13,
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 30,
  },
  addSubtaskBox: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subtaskInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  addSubtaskBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeTrack: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    marginTop: 8,
  },
  swipeText: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  swipeThumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 2,
    top: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  sessionsList: {
    gap: 10,
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  sessionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    fontWeight: "600",
  },
  sessionDuration: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  sessionTimes: {
    fontSize: 10,
    fontFamily: "monospace",
    marginBottom: 6,
  },
  sessionNote: {
    fontSize: 11,
    fontStyle: "italic",
    padding: 6,
    backgroundColor: "rgba(128,128,128,0.05)",
    borderRadius: 4,
  },
  timelineContainer: {
    position: "relative",
    paddingLeft: 28,
    paddingTop: 10,
  },
  timelineLine: {
    position: "absolute",
    left: 14,
    top: 15,
    bottom: 15,
    width: 2,
  },
  timelineNode: {
    flexDirection: "row",
    marginBottom: 18,
    position: "relative",
    alignItems: "flex-start",
  },
  nodeIconCircle: {
    position: "absolute",
    left: -26,
    top: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeContent: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  nodeTime: {
    fontSize: 9,
    fontFamily: "monospace",
  },
  lineThrough: {
    textDecorationLine: "line-through",
  },
});

interface TabWrapperProps {
  isLargeScreen: boolean;
  activeTab: string;
  tabName: string;
  tabBarWidth: number;
  children: React.ReactNode;
}

function TabPage({ isLargeScreen, activeTab, tabName, tabBarWidth, children }: TabWrapperProps) {
  if (isLargeScreen) {
    return (
      <View style={[styles.tabSection, { display: activeTab === tabName ? "flex" : "none" }]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView style={{ width: tabBarWidth }} showsVerticalScrollIndicator={false} {...{ delaysContentTouches: false }}>
      <View style={styles.tabSection}>
        {children}
      </View>
    </ScrollView>
  );
}

interface ParentProps {
  isLargeScreen: boolean;
  scrollViewRef: any;
  scrollHandler: any;
  handleScrollEnd: any;
  tabBarWidth: number;
  children: React.ReactNode;
}

function TabContentContainer({
  isLargeScreen,
  scrollViewRef,
  scrollHandler,
  handleScrollEnd,
  tabBarWidth,
  children,
}: ParentProps) {
  if (isLargeScreen) {
    return <ScrollView style={styles.scrollContent} {...{ delaysContentTouches: false }}>{children}</ScrollView>;
  }

  return (
    <Animated.ScrollView
      ref={scrollViewRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      onMomentumScrollEnd={handleScrollEnd}
      style={styles.scrollContent}
      contentContainerStyle={{ width: tabBarWidth * 4 }}
      {...{ delaysContentTouches: false }}
    >
      {children}
    </Animated.ScrollView>
  );
}
