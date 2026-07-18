import React, { useState, useEffect, useRef, useMemo } from "react";
import { countTotalReminders } from "../services/reminderUtils";
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
  Modal,
  Animated as RNAnimated,
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
import CalendarModal from "./sub_components/CalendarModal";
import AnalogClockModal from "./sub_components/AnalogClockModal";
import LogTimeModal from "./sub_components/LogTimeModal";
import SwipeButton from "./sub_components/SwipeButton";
import ConfirmationModal from "./sub_components/ConfirmationModal";

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
    | "subtask_added"
    | "time_logged"
    | "reminder_triggered";
  details?: {
    subtaskTitle?: string;
    oldDue?: string;
    newDue?: string;
    oldEst?: string;
    newEst?: string;
    note?: string;
    duration?: number;
    reminderResponse?: string;
    reminderTriggerTime?: number;
  };
}

export interface TaskReminder {
  remindBefore: number;       // ms before due date to start reminding
  repeatEvery?: number;       // ms between repeat notifications (optional)
  lastNotifiedAt?: number;    // timestamp of last notification fired
  dismissed?: boolean;        // user dismissed all reminders for this task
  lastNotificationStatus?: 'success' | 'failed';
  lastNotificationError?: string;
  lastNotificationTime?: number;
  lastNotificationId?: string;
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
  priority?: 'High' | 'Moderate' | 'Low';
  execStartDate?: string;
  execStartTime?: string;
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

const formatTime12h = (time24: string) => {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const parseDateTime = (dateStr: string, timeStr: string) => {
  let y, m, d;
  if (dateStr.includes("/")) {
    [d, m, y] = dateStr.split("/").map(Number);
  } else {
    [y, m, d] = dateStr.split("-").map(Number);
  }

  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = timeStr.match(timeRegex);
  let h = 0, min = 0;
  
  if (match) {
    let hour12 = Number(match[1]);
    min = Number(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hour12 < 12) hour12 += 12;
    if (ampm === "AM" && hour12 === 12) hour12 = 0;
    h = hour12;
  } else {
    const parts = timeStr.split(":");
    h = Number(parts[0]);
    min = Number(parts[1]);
  }

  return new Date(y, m - 1, d, h, min).getTime();
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

const formatDuration = (ms: number): string => {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) {
    const hours = Math.round(ms / 3_600_000);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.round(ms / 86_400_000);
  return `${days} day${days !== 1 ? 's' : ''}`;
};

const formatCountdown = (ms: number): string => {
  if (ms < 0) return "0s";
  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  let res = [];
  if (d > 0) res.push(`${d}d`);
  if (h > 0) res.push(`${h}h`);
  if (m > 0) res.push(`${m}m`);
  res.push(`${s}s`);
  return res.join(' ');
};

function getNextReminderTime(task: Task): number | null {
  if (task.done || !task.due || !task.reminder || task.reminder.dismissed) return null;
  const now = Date.now();
  let targetDueTime: number;
  if (task.dueTime) {
    const [y, m, d] = task.due.split('-').map(Number);
    const [h, min] = task.dueTime.split(':').map(Number);
    targetDueTime = new Date(y, m - 1, d, h, min, 0, 0).getTime();
  } else {
    const [y, m, d] = task.due.split('-').map(Number);
    targetDueTime = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  const dueEndOfDay = new Date(targetDueTime);
  dueEndOfDay.setHours(23, 59, 59, 999);
  if (now >= dueEndOfDay.getTime()) return null;
  if (task.dueTime && now >= targetDueTime) return null;

  let scheduleTime = targetDueTime - task.reminder.remindBefore;
  
  if (scheduleTime <= now) {
    if (!task.reminder.repeatEvery) {
      return null;
    } else {
      while (scheduleTime <= now && scheduleTime < targetDueTime) {
        scheduleTime += task.reminder.repeatEvery;
      }
      if (scheduleTime <= now || scheduleTime >= targetDueTime) return null;
    }
  }
  return scheduleTime;
}

const ReminderCountdown = ({ task, colors }: { task: Task, colors: any }) => {
  const [nextTime, setNextTime] = useState<number | null>(getNextReminderTime(task));
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    setNextTime(getNextReminderTime(task));
  }, [task]);

  useEffect(() => {
    if (!nextTime) return;
    const update = () => {
      const remaining = nextTime - Date.now();
      if (remaining <= 0) {
        setNextTime(getNextReminderTime(task));
      } else {
        setTimeLeft(remaining);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextTime, task]);

  if (!nextTime) return null;

  return (
    <View style={styles.detailSection}>
      <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>NEXT REMINDER</Text>
      <Text style={{ color: colors.ghBlue, fontWeight: "600", fontSize: 13, fontFamily: "monospace" }}>
        In {formatCountdown(timeLeft)}
      </Text>
    </View>
  );
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
  time_logged: { iconName: "clock", library: "Feather", label: "Manual time logged", color: "#8a2be2" },
  reminder_triggered: { iconName: "bell", library: "Feather", label: "Reminder triggered", color: "#58a6ff" },
};



const getDeadlineInfo = (dueDate?: string, colors?: any, isDone?: boolean) => {
  if (isDone) {
    return { color: colors.ghGreen || "#3fb950", label: "Completed", dotColor: colors.ghGreen || "#3fb950" };
  }
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

  const totalReminders = useMemo(() => {
    if (!task.due || !task.reminder || task.reminder.remindBefore === null) return 0;
    
    const [y, m, d] = task.due.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    
    if (task.dueTime) {
      const [h, min] = task.dueTime.split(':').map(Number);
      dateObj.setHours(h, min, 0, 0);
    } else {
      dateObj.setHours(0, 0, 0, 0);
    }
    
    return countTotalReminders(dateObj.getTime(), task.reminder.remindBefore, task.reminder.repeatEvery || 0);
  }, [task]);

  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [addSessionError, setAddSessionError] = useState("");

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [clockField, setClockField] = useState<"start" | "end">("start");
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getTodayLocalDateString = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}/${m}/${y}`;
  };

  const getLocalTimeString = (offsetMinutes = 0) => {
    const d = new Date(Date.now() + offsetMinutes * 60000);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  const openAddSessionModal = () => {
    setManualDate(getTodayLocalDateString());
    setManualStartTime(getLocalTimeString(-60));
    setManualEndTime(getLocalTimeString(0));
    setManualNote("");
    setAddSessionError("");
    setSaveSuccess(false);
    setIsAddSessionOpen(true);
  };

  const handleManualAddSession = (): boolean => {
    if (!task) return false;

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

    if (!dateRegex.test(manualDate)) {
      setAddSessionError("Date must be in DD/MM/YYYY format.");
      return false;
    }
    if (!timeRegex.test(manualStartTime)) {
      setAddSessionError("Start Time must be HH:MM AM/PM format (e.g. 09:00 AM).");
      return false;
    }
    if (!timeRegex.test(manualEndTime)) {
      setAddSessionError("End Time must be HH:MM AM/PM format (e.g. 10:00 AM).");
      return false;
    }

    const startMs = parseDateTime(manualDate, manualStartTime);
    const endMs = parseDateTime(manualDate, manualEndTime);

    if (isNaN(startMs) || isNaN(endMs)) {
      setAddSessionError("Invalid Date or Time entered.");
      return false;
    }

    if (endMs <= startMs) {
      setAddSessionError("End time must be after start time.");
      return false;
    }

    if (endMs > Date.now()) {
      setAddSessionError("Cannot log time in the future.");
      return false;
    }

    // Validation passed. Instead of saving immediately, open the confirmation modal.
    setIsConfirmationModalOpen(true);
    return false; // Return false so LogTimeModal doesn't close yet
  };

  const commitManualSession = () => {
    if (!task) return;
    const startMs = parseDateTime(manualDate, manualStartTime);
    const endMs = parseDateTime(manualDate, manualEndTime);

    const newSess: Session = {
      id: "sess_" + Date.now(),
      start: startMs,
      end: endMs,
      note: manualNote.trim() || undefined,
    };

    const duration = Math.floor((endMs - startMs) / 1000);
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "time_logged",
      details: { duration, note: manualNote.trim() || undefined },
    };

    const updatedSessions = [...(task.sessions || []), newSess].sort((a, b) => b.start - a.start);

    onUpdateTask({
      ...task,
      sessions: updatedSessions,
      auditLog: [...(task.auditLog || []), audit],
    });

    setSaveSuccess(true); // Trigger smooth slide-out animation on LogTimeModal
  };

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

  const dlInfo = getDeadlineInfo(task.due, colors, task.done);
  const isThisTaskTimerRunning =
    isTimerRunning && activeTimerTaskId === task.id;

  const totalTimeSpentMs = (task.sessions || []).reduce((acc, sess) => acc + (sess.end - sess.start), 0) + (isThisTaskTimerRunning ? timerSeconds * 1000 : 0);
  const timeSpentStr = totalTimeSpentMs > 0 ? fmtSeconds(Math.floor(totalTimeSpentMs / 1000)) : "0m";

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

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingRight: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  SUBTASKS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Octicons name="tasklist" size={14} color={colors.ghMuted} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: "500" }}>
                    {subtasksDone} / {totalSubtasks}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  TIME SPENT
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="clock" size={14} color={colors.ghMuted} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: "500" }}>
                    {timeSpentStr}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                ATTRIBUTES
              </Text>
              
              {(() => {
                const now = new Date();
                const createdAtStr = new Date(task.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                let execStartStr = "-";
                if (task.execStartDate) {
                  execStartStr = fmtDateDisplay(task.execStartDate) + (task.execStartTime ? ` at ${formatTime12h(task.execStartTime)}` : "");
                }
                
                let dueStr = "-";
                if (task.due) {
                  dueStr = fmtDateDisplay(task.due) + (task.dueTime ? ` at ${formatTime12h(task.dueTime)}` : "");
                }

                let activeTimeStr = "-";
                let overdueTimeStr = "-";

                if (task.due) {
                  const dueObj = new Date(task.due + "T00:00:00");
                  if (task.dueTime) {
                    const [h, m] = task.dueTime.split(":").map(Number);
                    dueObj.setHours(h, m, 0, 0);
                  }
                  
                  const diffMs = dueObj.getTime() - now.getTime();
                  
                  if (diffMs < 0) {
                    const overMs = Math.abs(diffMs);
                    const overDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
                    const overHours = Math.floor((overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    overdueTimeStr = `${overDays}d ${overHours}h`;
                  }

                  if (task.execStartDate) {
                    const execObj = new Date(task.execStartDate + "T00:00:00");
                    if (task.execStartTime) {
                      const [h, m] = task.execStartTime.split(":").map(Number);
                      execObj.setHours(h, m, 0, 0);
                    }
                    if (now.getTime() >= execObj.getTime() && diffMs >= 0) {
                      const activeMs = now.getTime() - execObj.getTime();
                      const actDays = Math.floor(activeMs / (1000 * 60 * 60 * 24));
                      const actHours = Math.floor((activeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                      activeTimeStr = `${actDays}d ${actHours}h`;
                    }
                  }
                }

                const renderAttr = (label: string, value: string, color: string = colors.ghText) => (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ghBorder2 }}>
                    <Text style={{ color: colors.ghMuted, fontSize: 13 }}>{label}</Text>
                    <Text style={{ color, fontSize: 13, fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 }}>{value}</Text>
                  </View>
                );

                return (
                  <View style={{ backgroundColor: colors.ghSurface2, borderRadius: 8, paddingHorizontal: 12 }}>
                    {renderAttr("Created", createdAtStr)}
                    {renderAttr("Priority", task.priority || "Low", task.priority === 'High' ? (colors.ghRed || '#f85149') : task.priority === 'Moderate' ? (colors.ghAmber || '#d29922') : (colors.ghGreen || '#3fb950'))}
                    {renderAttr("Execution Start", execStartStr)}
                    {renderAttr("Due", dueStr)}
                    {activeTimeStr !== "-" && renderAttr("Active Time", activeTimeStr, "#56d4dd")}
                    {overdueTimeStr !== "-" && renderAttr("Overdue Time", overdueTimeStr, colors.ghRed || '#f85149')}
                  </View>
                );
              })()}
            </View>

            {task.notes ? (
              <View style={[styles.detailSection, { marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
                  NOTES
                </Text>
                <Text style={[styles.notesText, { color: colors.ghText }]}>
                  {task.notes}
                </Text>
              </View>
            ) : null}

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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                LOGGED SESSIONS
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.ghSurface2,
                  borderColor: colors.ghBorder,
                  borderWidth: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                }}
                onPress={openAddSessionModal}
              >
                <Feather name="plus" size={12} color={colors.ghText} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.ghText, fontSize: 11, fontWeight: "600" }}>
                  Add Time
                </Text>
              </TouchableOpacity>
            </View>
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
                  const dObj = new Date(sess.start);
                  const dateStr = `${String(dObj.getDate()).padStart(2, "0")}/${String(dObj.getMonth() + 1).padStart(2, "0")}/${dObj.getFullYear()}`;

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
                  } else if (entry.action === "time_logged") {
                    const dur = entry.details?.duration ? fmtSeconds(entry.details.duration) : "";
                    const noteStr = entry.details?.note ? ` Note: "${entry.details.note}"` : "";
                    detailsText = `for ${dur}${noteStr}`;
                  } else if (entry.action === "due_changed") {
                    detailsText = `to ${fmtDateDisplay(entry.details?.newDue)}`;
                  } else if (entry.action === "reminder_triggered") {
                    detailsText = entry.details?.reminderResponse
                      ? `Response: "${entry.details.reminderResponse}"`
                      : "(no response)";
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

      <LogTimeModal
        visible={isAddSessionOpen}
        onClose={() => setIsAddSessionOpen(false)}
        colors={colors}
        manualDate={manualDate}
        onOpenCalendar={() => setIsCalendarModalOpen(true)}
        manualStartTime={manualStartTime}
        manualEndTime={manualEndTime}
        onOpenClock={(field) => {
          setClockField(field);
          setIsClockModalOpen(true);
        }}
        manualNote={manualNote}
        onChangeNote={setManualNote}
        addSessionError={addSessionError}
        onSave={handleManualAddSession}
        saveSuccess={saveSuccess}
      />

      <CalendarModal
        visible={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        onSelectDate={setManualDate}
        initialDateStr={manualDate}
        colors={colors}
      />

      <AnalogClockModal
        visible={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
        onSelectTime={(time) => {
          if (clockField === "start") {
            setManualStartTime(time);
          } else {
            setManualEndTime(time);
          }
        }}
        initialTimeStr={clockField === "start" ? manualStartTime : manualEndTime}
        colors={colors}
        title={clockField === "start" ? "Start Time" : "End Time"}
      />

      <ConfirmationModal
        visible={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={commitManualSession}
        title="Confirm Entry"
        description={`Log time from ${manualStartTime} to ${manualEndTime}?`}
        colors={colors}
      />

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
