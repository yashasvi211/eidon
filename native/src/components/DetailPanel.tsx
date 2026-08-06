import React, { useState, useEffect, useRef, useMemo } from "react";
import { countTotalReminders, generateSchedulePreview, formatEstimateDisplay } from "../services/reminderUtils";
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
  Alert,
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
  interpolateColor,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather, Octicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import CalendarModal from "./sub_components/CalendarModal";
import AnalogClockModal from "./sub_components/AnalogClockModal";
import LogTimeModal from "./sub_components/LogTimeModal";
import SwipeButton from "./sub_components/SwipeButton";
import ConfirmationModal from "./sub_components/ConfirmationModal";
import AddSubtaskModal from "./sub_components/AddSubtaskModal";
import TaskOptionsModal from "./sub_components/TaskOptionsModal";

// Pull-down dismiss threshold: if user drags past this many pixels, we close
const DISMISS_THRESHOLD = 120;
// Spring config for buttery-smooth native-thread animations
const OPEN_SPRING = { damping: 28, stiffness: 220, mass: 0.9 };
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.7 };
const EXIT_DURATION = 250;
const EXIT_EASING = Easing.bezierFn(0.4, 0, 1, 1);

const AnimatedFeather = Animated.createAnimatedComponent(Feather);

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  description?: string;
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
    | "reminder_triggered"
    | "notes_updated"
    | "task_updated";
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
    notePreview?: string;
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

export interface StreakEntry {
  id: string;
  periodDue: string;         // YYYY-MM-DD — the due date of this recurrence window
  completed: boolean;        // Did user complete before deadline?
  completedAt?: number;      // Timestamp when completed
  missed: boolean;           // Auto-marked missed when deadline passed without completion
}

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  streakEnabled: boolean;    // Whether to track streaks for this task
  currentStreak: number;     // Active consecutive completions
  maxStreak: number;         // All-time best streak
  history: StreakEntry[];    // Log of every recurrence window
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
  recurrence?: RecurrenceConfig;  // If set, this is a recurring task
  muted?: boolean;               // If true, suppress all notifications for this task
}

interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
  onToggleDone: (id: string) => void;
  onUpdateTask: (updated: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (id: string) => void;
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
  notes_updated: { iconName: "file-text", library: "Feather", label: "Notes updated", color: "#58a6ff" },
  task_updated: { iconName: "edit", library: "Feather", label: "Task updated", color: "#58a6ff" },
};



const getDeadlineInfo = (dueDate?: string, colors?: any, isDone?: boolean, dueTime?: string) => {
  if (isDone) {
    return { color: colors.ghGreen || "#3fb950", label: "Completed", dotColor: colors.ghGreen || "#3fb950" };
  }
  if (!dueDate)
    return { color: colors.ghText, label: "", dotColor: "transparent" };
  const now = new Date();
  const due = new Date(dueDate + "T00:00:00");
  if (dueTime && dueTime.trim() !== '') {
    const [h, m] = dueTime.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) due.setHours(h, m, 0, 0);
  } else {
    due.setHours(23, 59, 59, 999);
  }
  const diffMs = due.getTime() - now.getTime();

  if (diffMs < 0) {
    const overMs = Math.abs(diffMs);
    const overDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
    const overHours = Math.floor((overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const overMins = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60));
    let labelStr = `${overDays}d overdue`;
    if (overDays === 0 && overHours > 0) labelStr = `${overHours}h overdue`;
    else if (overDays === 0 && overHours === 0) labelStr = `${Math.max(1, overMins)}m overdue`;
    return {
      color: "#f85149",
      label: `! Overdue`,
      dotColor: "#f85149",
    };
  }
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
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
  onEditTask,
  onDeleteTask,
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
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  if (!task) return null;

  const [localActiveTab, setLocalActiveTab] = useState<
    "details" | "checklist" | "timetracking" | "history"
  >("details");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotesText, setEditedNotesText] = useState("");

  const doneAnim = useSharedValue(task?.done ? 1 : 0);
  useEffect(() => {
    if (task) {
      doneAnim.value = withTiming(task.done ? 1 : 0, { duration: 350 });
      setIsEditingNotes(false);
    }
  }, [task?.done, task?.id]);

  const totalReminders = useMemo(() => {
    if (!task || !task.due || !task.reminder || task.reminder.remindBefore === null) return 0;
    
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
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isAddSubtaskModalOpen, setIsAddSubtaskModalOpen] = useState(false);
  const [subtaskToConfirm, setSubtaskToConfirm] = useState<string | null>(null);

  const [nowTime, setNowTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextReminder = useMemo(() => {
    if (!task || !task.due || !task.reminder || task.reminder.remindBefore === null) return null;
    const [y, m, d] = task.due.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (task.dueTime) {
      const [h, min] = task.dueTime.split(':').map(Number);
      dateObj.setHours(h, min, 0, 0);
    } else {
      dateObj.setHours(0, 0, 0, 0);
    }
    const schedule = generateSchedulePreview(dateObj.getTime(), task.reminder.remindBefore, task.reminder.repeatEvery || 0);
    const futureReminders = schedule.filter(dt => dt.getTime() > nowTime);
    if (futureReminders.length > 0) {
      return futureReminders[0];
    }
    return null;
  }, [task, nowTime]);

  const formatCustomDate = (date: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[date.getMonth()];
    const d = date.getDate();
    const yy = String(date.getFullYear()).slice(-2);
    let h = date.getHours();
    const min = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const hStr = String(h).padStart(2, '0');
    return `${d} ${m} ${yy}, ${hStr}:${min}${ampm}`;
  };

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

  // Pull-down-to-close pan gesture (mobile only).
  // Factory: RNGH allows one gesture instance per GestureDetector, so handle +
  // title each get their own pan. The 3-dots button is never inside either.
  const makePanGesture = () =>
    Gesture.Pan()
      .activeOffsetY([10, -10])
      .failOffsetX([-15, 15])
      .onUpdate((e) => {
        // Only allow dragging downward (positive translationY)
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
          translateY.value = withTiming(height, {
            duration: EXIT_DURATION,
            easing: EXIT_EASING,
          }, () => {
            runOnJS(onClose)();
          });
          dragY.value = withTiming(0, { duration: EXIT_DURATION });
        } else {
          dragY.value = withSpring(0, SNAP_SPRING);
        }
      });

  const panOnHandle = useMemo(() => makePanGesture(), [height, onClose]);
  const panOnTitle = useMemo(() => makePanGesture(), [height, onClose]);

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

  // Reset tab, scroll, and options modal on task change
  useEffect(() => {
    setActiveTab("details");
    setSessionNote("");
    setOptionsModalVisible(false);
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

  const dlInfo = getDeadlineInfo(task.due, colors, task.done, task.dueTime);
  const isThisTaskTimerRunning =
    isTimerRunning && activeTimerTaskId === task.id;

  const totalTimeSpentMs = (task.sessions || []).reduce((acc, sess) => acc + (sess.end - sess.start), 0) + (isThisTaskTimerRunning ? timerSeconds * 1000 : 0);
  const timeSpentStr = totalTimeSpentMs > 0 ? fmtSeconds(Math.floor(totalTimeSpentMs / 1000)) : "0m";

  const handleToggleSubtaskPress = (subId: string) => {
    const sub = subtasks.find(s => s.id === subId);
    if (!sub) return;
    if (sub.done) {
      handleToggleSubtask(subId);
    } else {
      setSubtaskToConfirm(subId);
    }
  };

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

  const handleSaveNotes = () => {
    const newNotes = editedNotesText.trim();
    if (newNotes === (task.notes || '')) {
      setIsEditingNotes(false);
      return;
    }
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "notes_updated",
      details: { notePreview: newNotes || "(cleared)" },
    };
    onUpdateTask({
      ...task,
      notes: newNotes || undefined,
      auditLog: [...(task.auditLog || []), audit],
    });
    setIsEditingNotes(false);
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

  const handleAddSubtask = (title: string, description: string) => {
    const newSub: Subtask = {
      id: "s" + Date.now(),
      title,
      done: false,
      description: description || undefined,
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
  };

  // Header actions must live OUTSIDE the pan GestureDetector.
  // If the 3-dots sits inside the pull-to-dismiss pan, the pan steals the
  // first touch and the menu only opens after multiple taps.
  const headerActions = (
    <View style={styles.headerActions}>
      {(onEditTask || onDeleteTask) && (
        <TouchableOpacity
          style={styles.optionsBtn}
          onPress={() => setOptionsModalVisible(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Task options"
        >
          <Feather name="more-vertical" size={20} color={colors.ghMuted} />
        </TouchableOpacity>
      )}
      {isLargeScreen && (
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={{ color: colors.ghMuted, fontSize: 24, lineHeight: 24 }}>×</Text>
        </TouchableOpacity>
      )}
    </View>
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
      {/* Mobile: pan on handle + title only. 3-dots is a flex sibling (no overlap)
          so the pan never steals the first tap. */}
      {!isLargeScreen ? (
        <View style={[styles.headerBlock, { borderBottomColor: colors.ghBorder }]}>
          <GestureDetector gesture={panOnHandle}>
            <Animated.View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: colors.ghBorder2 }]} />
            </Animated.View>
          </GestureDetector>
          <View style={styles.headerRow}>
            <GestureDetector gesture={panOnTitle}>
              <Animated.View style={styles.headerTitleWrap}>
                <Text
                  style={[styles.headerTitle, { color: colors.ghText }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
              </Animated.View>
            </GestureDetector>
            {headerActions}
          </View>
        </View>
      ) : (
        <View style={[styles.header, { borderBottomColor: colors.ghBorder, paddingRight: 10 }]}>
          <Text
            style={[styles.headerTitle, { color: colors.ghText }]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {headerActions}
        </View>
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
            {/* ── Streak Banner (compact) for recurring tasks ── */}
            {task.recurrence?.streakEnabled && (() => {
              const rec = task.recurrence!;
              return (
                <View style={{ backgroundColor: 'rgba(240,136,62,0.07)', borderWidth: 1, borderColor: 'rgba(240,136,62,0.22)', borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(240,136,62,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, color: '#f0883e', fontWeight: '800' }}>★</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f0883e', fontSize: 13, fontWeight: '700' }}>
                      {rec.currentStreak > 0 ? `${rec.currentStreak}-day streak!` : 'Start your streak today!'}
                    </Text>
                    <Text style={{ color: colors.ghMuted, fontSize: 11, marginTop: 1 }}>
                      Best: {rec.maxStreak} • {rec.frequency.charAt(0).toUpperCase() + rec.frequency.slice(1)} recurring
                    </Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(240,136,62,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ color: '#f0883e', fontSize: 11, fontWeight: '700' }}>★ {rec.maxStreak} best</Text>
                  </View>
                </View>
              );
            })()}

            {/* Overdue Alert Banner / Card */}
            {(() => {
              if (task.done || !task.due) return null;
              const now = new Date();
              const due = new Date(task.due + "T00:00:00");
              if (task.dueTime && task.dueTime.trim() !== '') {
                const [h, m] = task.dueTime.split(":").map(Number);
                if (!isNaN(h) && !isNaN(m)) due.setHours(h, m, 0, 0);
              } else {
                due.setHours(23, 59, 59, 999);
              }
              const diffMs = due.getTime() - now.getTime();
              if (diffMs >= 0) return null;
              const overMs = Math.abs(diffMs);
              const ovdDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
              const ovdHours = Math.floor((overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const ovdMins = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60));
              let timeStr = `${ovdDays} ${ovdDays === 1 ? 'day' : 'days'}`;
              if (ovdDays === 0 && ovdHours > 0) timeStr = `${ovdHours} ${ovdHours === 1 ? 'hour' : 'hours'}`;
              else if (ovdDays === 0 && ovdHours === 0) timeStr = `${Math.max(1, ovdMins)} ${ovdMins === 1 ? 'minute' : 'minutes'}`;
              return (
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(248, 81, 73, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(248, 81, 73, 0.35)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16
                }}>
                  <View style={{
                    backgroundColor: colors.ghRed || "#f85149",
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12
                  }}>
                    <Feather name="alert-octagon" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ghRed || "#f85149", fontWeight: "700", fontSize: 14, marginBottom: 2 }}>
                      ! Task is Overdue by {timeStr}
                    </Text>
                    <Text style={{ color: colors.ghMuted, fontSize: 12 }}>
                      Due date was {task.dueTime ? formatCustomDate(due) : formatCustomDate(due).split(',')[0]}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Status & Priority Row */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {/* Status Card */}
              <Animated.View style={[
                { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
                useAnimatedStyle(() => ({
                  backgroundColor: interpolateColor(doneAnim.value, [0, 1], [colors.ghSurface, "rgba(63, 185, 80, 0.08)"]),
                  borderColor: interpolateColor(doneAnim.value, [0, 1], [colors.ghBorder, "rgba(63, 185, 80, 0.3)"])
                }))
              ]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <Animated.View style={[
                    { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 },
                    useAnimatedStyle(() => ({
                      backgroundColor: interpolateColor(doneAnim.value, [0, 1], ["rgba(139, 148, 158, 0.12)", "rgba(63, 185, 80, 0.15)"]),
                      transform: [{ scale: interpolate(doneAnim.value, [0, 0.5, 1], [1, 1.2, 1]) }]
                    }))
                  ]}>
                    {task.done ? (
                      <Feather name="check-circle" size={14} color={colors.ghGreen} />
                    ) : (
                      <Feather name="circle" size={14} color={colors.ghMuted} />
                    )}
                  </Animated.View>
                  <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                    STATUS
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!task.done) {
                      setIsCompleteModalOpen(true);
                    } else {
                      onToggleDone(task.id);
                    }
                  }}
                >
                  <Animated.View style={[
                    styles.statusToggle,
                    { padding: 10, borderRadius: 8 },
                    useAnimatedStyle(() => ({
                      backgroundColor: interpolateColor(doneAnim.value, [0, 1], [colors.ghSurface2, "rgba(63, 185, 80, 0.08)"])
                    }))
                  ]}>
                    <Animated.View
                      style={[
                        styles.statusCircle,
                        useAnimatedStyle(() => ({
                          borderColor: interpolateColor(doneAnim.value, [0, 1], [colors.ghBorder2, colors.ghGreen]),
                          backgroundColor: interpolateColor(doneAnim.value, [0, 1], ["transparent", colors.ghGreen])
                        }))
                      ]}
                    >
                      {task.done && (
                        <Text style={{ color: "#fff", fontSize: 10 }}>✓</Text>
                      )}
                    </Animated.View>
                    <Animated.Text
                      style={[
                        { fontWeight: "600", fontSize: 13 },
                        useAnimatedStyle(() => ({
                          color: interpolateColor(doneAnim.value, [0, 1], [colors.ghText, colors.ghGreen])
                        }))
                      ]}
                    >
                      {task.done ? "Completed" : "Mark complete"}
                    </Animated.Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>

              {/* Priority Card */}
              {(() => {
                const p = task.priority || "Low";
                const pColor = p === 'High' ? (colors.ghRed || '#f85149') : p === 'Moderate' ? (colors.ghAmber || '#d29922') : (colors.ghGreen || '#3fb950');
                const pBg = p === 'High' ? 'rgba(248, 81, 73, 0.12)' : p === 'Moderate' ? 'rgba(210, 153, 34, 0.12)' : 'rgba(63, 185, 80, 0.12)';
                const pIcon = p === 'High' ? 'alert-circle' : p === 'Moderate' ? 'alert-triangle' : 'chevrons-down';
                return (
                  <View style={{ flex: 1, backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                      <View style={{ backgroundColor: pBg, width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                        <Feather name={pIcon as any} size={14} color={pColor} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                        PRIORITY
                      </Text>
                    </View>
                    <View style={{ backgroundColor: `${pColor}14`, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" }}>
                      <Text style={{ color: pColor, fontWeight: "700", fontSize: 13 }}>
                        {p}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Overview Stats Card */}
            <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }}>
                {/* Project */}
                <View style={{ width: "50%", padding: 5, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ backgroundColor: "rgba(188, 140, 255, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                      <Feather name="folder" size={13} color={colors.ghPurple} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                      PROJECT
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tag,
                      {
                        color: colors.ghPurple,
                        backgroundColor: "rgba(188, 140, 255, 0.08)",
                        borderColor: "rgba(188, 140, 255, 0.25)",
                        alignSelf: "flex-start",
                      },
                    ]}
                  >
                    {task.project}
                  </Text>
                </View>
                
                {/* Estimate */}
                {task.est ? (
                  <View style={{ width: "50%", padding: 5, marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <View style={{ backgroundColor: "rgba(210, 153, 34, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                        <Feather name="target" size={13} color={colors.ghAmber} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                        ESTIMATE
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.ghText,
                        fontFamily: "monospace",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {formatEstimateDisplay(task.est)}
                    </Text>
                  </View>
                ) : null}

                {/* Subtasks */}
                <View style={{ width: "50%", padding: 5 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ backgroundColor: "rgba(86, 212, 221, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                      <Octicons name="tasklist" size={13} color={"#56d4dd"} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                      SUBTASKS
                    </Text>
                  </View>
                  <Text style={{ color: colors.ghText, fontSize: 16, fontWeight: "700", fontFamily: "monospace" }}>
                    {subtasksDone}<Text style={{ color: colors.ghMuted, fontWeight: "400" }}> / {totalSubtasks}</Text>
                  </Text>
                </View>

                {/* Time Spent */}
                <View style={{ width: "50%", padding: 5 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ backgroundColor: "rgba(88, 166, 255, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                      <Feather name="clock" size={13} color={colors.ghBlue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                      TIME SPENT
                    </Text>
                  </View>
                  <Text style={{ color: colors.ghText, fontSize: 16, fontWeight: "700", fontFamily: "monospace" }}>
                    {timeSpentStr}
                  </Text>
                </View>
              </View>
            </View>

            {/* Attributes Card */}
            <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View style={{ backgroundColor: "rgba(139, 148, 158, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                  <Feather name="list" size={13} color={colors.ghMuted} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                  ATTRIBUTES
                </Text>
              </View>
              
              {(() => {
                const createdAtStr = task.createdAt ? formatCustomDate(new Date(task.createdAt)) : "-";
                
                let execStartStr = "-";
                if (task.execStartDate) {
                  const execDate = new Date(task.execStartDate + "T00:00:00");
                  if (task.execStartTime) {
                    const [hh, mm] = task.execStartTime.split(":").map(Number);
                    execDate.setHours(hh, mm, 0, 0);
                  }
                  execStartStr = formatCustomDate(execDate);
                }
                
                let dueStr = "-";
                if (task.due) {
                  const dueDate = new Date(task.due + "T00:00:00");
                  if (task.dueTime) {
                    const [hh, mm] = task.dueTime.split(":").map(Number);
                    dueDate.setHours(hh, mm, 0, 0);
                  }
                  dueStr = formatCustomDate(dueDate);
                }

                let completedAtStr = null;
                if (task.completedAt) {
                  completedAtStr = formatCustomDate(new Date(task.completedAt));
                }

                let overdueTimeStr = "-";
                let timeLeftStr = "-";

                if (task.due) {
                  const dueObj = new Date(task.due + "T00:00:00");
                  if (task.dueTime) {
                    const [h, m] = task.dueTime.split(":").map(Number);
                    dueObj.setHours(h, m, 0, 0);
                  }
                  
                  const diffMs = dueObj.getTime() - nowTime;
                  
                  if (diffMs > 0 && !task.done) {
                    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                    const m = Math.floor((diffMs / 1000 / 60) % 60);
                    const s = Math.floor((diffMs / 1000) % 60);
                    timeLeftStr = `${d}d ${h}h ${m}m ${s}s`;
                  } else if (diffMs < 0) {
                    const overMs = Math.abs(diffMs);
                    const overDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
                    const overHours = Math.floor((overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const overMins = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60));
                    const overSecs = Math.floor((overMs / 1000) % 60);
                    overdueTimeStr = `${overDays}d ${overHours}h ${overMins}m ${overSecs}s`;
                  }
                }

                const attrIconMap: { [key: string]: { name: string; color: string } } = {
                  "Created": { name: "plus-circle", color: colors.ghGreen },
                  "Completed": { name: "check-circle", color: colors.ghGreen },
                  "Execution Start": { name: "play-circle", color: colors.ghBlue },
                  "Due": { name: "calendar", color: colors.ghBlue },
                  "Time Left": { name: "clock", color: colors.ghBlue },
                  "Overdue Time": { name: "alert-circle", color: colors.ghRed },
                };

                const renderAttr = (label: string, value: string, color: string = colors.ghText, isLast: boolean = false) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.ghBorder }}>
                    <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: `${(attrIconMap[label]?.color || colors.ghMuted)}15`, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                      <Feather name={(attrIconMap[label]?.name || "info") as any} size={12} color={attrIconMap[label]?.color || colors.ghMuted} />
                    </View>
                    <Text style={{ color: colors.ghMuted, fontSize: 13, flex: 1 }}>{label}</Text>
                    <Text style={{ color, fontSize: 13, fontWeight: "600" }}>{value}</Text>
                  </View>
                );

                const rows: { label: string; value: string; color: string }[] = [];
                rows.push({ label: "Created", value: createdAtStr, color: colors.ghText });
                if (completedAtStr) rows.push({ label: "Completed", value: completedAtStr, color: colors.ghGreen || "#3fb950" });
                rows.push({ label: "Execution Start", value: execStartStr, color: colors.ghText });
                rows.push({ label: "Due", value: dueStr, color: colors.ghText });
                if (timeLeftStr !== "-") rows.push({ label: "Time Left", value: timeLeftStr, color: colors.ghBlue || "#58a6ff" });
                if (overdueTimeStr !== "-") rows.push({ label: "Overdue Time", value: overdueTimeStr, color: colors.ghRed || '#f85149' });

                return (
                  <View>
                    {rows.map((row, idx) => renderAttr(row.label, row.value, row.color, idx === rows.length - 1))}
                  </View>
                );
              })()}
            </View>

            {/* NOTES Card after Attributes */}
            <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ backgroundColor: "rgba(139, 148, 158, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                    <Feather name="file-text" size={13} color={colors.ghMuted} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                    NOTES
                  </Text>
                </View>
                {!isEditingNotes ? (
                  <TouchableOpacity
                    style={{ padding: 4 }}
                    onPress={() => {
                      setEditedNotesText(task.notes || '');
                      setIsEditingNotes(true);
                    }}
                  >
                    <Feather name="edit-2" size={14} color={colors.ghMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!isEditingNotes ? (
                <View>
                  {task.notes && task.notes.trim() ? (
                    <Text style={[styles.notesText, { color: colors.ghText }]}>
                      {task.notes}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.ghMuted, fontSize: 13, fontStyle: "italic" }}>
                      No notes added yet. Click the edit icon to add notes...
                    </Text>
                  )}
                </View>
              ) : (
                <View>
                  <TextInput
                    style={{
                      backgroundColor: colors.ghBg,
                      borderWidth: 1,
                      borderColor: colors.ghBlue,
                      borderRadius: 8,
                      padding: 12,
                      color: colors.ghText,
                      fontSize: 14,
                      minHeight: 100,
                      textAlignVertical: "top",
                      marginBottom: 10
                    }}
                    value={editedNotesText}
                    onChangeText={setEditedNotesText}
                    placeholder="Add notes, descriptions, or links for this task..."
                    placeholderTextColor={colors.ghMuted}
                    multiline
                    autoFocus
                  />
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.ghSurface2, borderWidth: 1, borderColor: colors.ghBorder }}
                      onPress={() => setIsEditingNotes(false)}
                    >
                      <Text style={{ color: colors.ghMuted, fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.ghBlue }}
                      onPress={handleSaveNotes}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

          </TabPage>

        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="checklist"
          tabBarWidth={tabBarWidth}
        >
            {/* Checklist Header Card */}
            <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ backgroundColor: "rgba(86, 212, 221, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                  <Octicons name="tasklist" size={13} color={"#56d4dd"} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                  CHECKLIST ({subtasksDone}/{totalSubtasks})
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.ghBlue,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
                onPress={() => setIsAddSubtaskModalOpen(true)}
              >
                <Feather name="plus" size={12} color={"#ffffff"} style={{ marginRight: 4 }} />
                <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "600" }}>
                  Add Task
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subtasks List */}
            {subtasks.length === 0 ? (
              <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14 }}>
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <View style={{ backgroundColor: "rgba(139, 148, 158, 0.08)", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Octicons name="tasklist" size={18} color={colors.ghMuted} />
                  </View>
                  <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
                    No subtasks added yet
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                {subtasks.map((sub, idx) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: 11,
                      paddingHorizontal: 4,
                      borderBottomWidth: idx < subtasks.length - 1 ? 1 : 0,
                      borderBottomColor: colors.ghBorder,
                      gap: 10,
                    }}
                    onPress={() => handleToggleSubtaskPress(sub.id)}
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
                          marginTop: 2,
                        },
                      ]}
                    >
                      {sub.done && (
                        <Octicons name="check" size={10} color="#ffffff" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.checkText,
                          { color: sub.done ? colors.ghMuted : colors.ghText },
                          sub.done && styles.lineThrough,
                        ]}
                      >
                        {sub.title}
                      </Text>
                      {sub.description ? (
                        <Text style={{ color: colors.ghMuted, fontSize: 12, marginTop: 4 }}>
                          {sub.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </TabPage>

        <TabPage
          isLargeScreen={isLargeScreen}
          activeTab={activeTab}
          tabName="timetracking"
          tabBarWidth={tabBarWidth}
        >
            {/* Header Card */}
            <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ backgroundColor: "rgba(88, 166, 255, 0.12)", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                  <Feather name="clock" size={13} color={colors.ghBlue} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 0 }]}>
                  LOGGED SESSIONS
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.ghBlue,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
                onPress={openAddSessionModal}
              >
                <Feather name="plus" size={12} color={"#ffffff"} style={{ marginRight: 4 }} />
                <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "600" }}>
                  Add Time
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sessions List */}
            {!task.sessions || task.sessions.length === 0 ? (
              <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14 }}>
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <View style={{ backgroundColor: "rgba(139, 148, 158, 0.08)", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Feather name="clock" size={18} color={colors.ghMuted} />
                  </View>
                  <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
                    No time has been logged on this task
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
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
                      style={{
                        backgroundColor: colors.ghSurface,
                        borderWidth: 1,
                        borderColor: colors.ghBorder,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ backgroundColor: "rgba(88, 166, 255, 0.12)", width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                            <Feather name="play" size={11} color={colors.ghBlue} />
                          </View>
                          <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: "600" }}>
                            {dateStr}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: `${colors.ghBlue}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: colors.ghBlue, fontSize: 12, fontWeight: "700", fontFamily: "monospace" }}>
                            {fmtSeconds(duration)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 32 }}>
                        <Text style={{ color: colors.ghMuted, fontSize: 11, fontFamily: "monospace" }}>
                          {startStr} — {endStr}
                        </Text>
                      </View>
                      {sess.note ? (
                        <View style={{ backgroundColor: `${colors.ghMuted}08`, padding: 8, borderRadius: 6, marginTop: 6, marginLeft: 32 }}>
                          <Text
                            style={{ color: colors.ghText, fontSize: 11, fontStyle: "italic" }}
                          >
                            "{sess.note}"
                          </Text>
                        </View>
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
            {/* ── Streak Dashboard (only for recurring tasks with streaks enabled) ── */}
            {task.recurrence?.streakEnabled && (() => {
              const rec = task.recurrence!;
              const history = rec.history || [];
              const freqLabel = rec.frequency === 'daily' ? 'Daily' : rec.frequency === 'weekly' ? 'Weekly' : 'Monthly';

              // Last 28 entries for the dot grid
              const dotHistory = history.slice(-28);

              const fmtPeriodDate = (iso: string) => {
                const [y, m, d] = iso.split('-').map(Number);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${months[m-1]} ${d}`;
              };

              return (
                <View style={{ marginBottom: 20 }}>
                  {/* Header: Streak type badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ backgroundColor: 'rgba(240, 136, 62, 0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, color: '#f0883e', fontWeight: '800' }}>★</Text>
                      <Text style={{ color: '#f0883e', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{freqLabel} Streak</Text>
                    </View>
                  </View>

                  {/* Current + Max Streak Cards */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                    {/* Current Streak */}
                    <View style={{ flex: 1, backgroundColor: rec.currentStreak > 0 ? 'rgba(240, 136, 62, 0.08)' : colors.ghSurface, borderWidth: 1, borderColor: rec.currentStreak > 0 ? 'rgba(240, 136, 62, 0.3)' : colors.ghBorder, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, fontWeight: '800', color: rec.currentStreak > 0 ? '#f0883e' : colors.ghMuted }}>
                        {rec.currentStreak}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.ghMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Streak</Text>
                      <Text style={{ fontSize: 9, color: colors.ghMuted, marginTop: 2 }}>{rec.currentStreak === 1 ? '1 in a row' : `${rec.currentStreak} in a row`}</Text>
                    </View>

                    {/* Max Streak */}
                    <View style={{ flex: 1, backgroundColor: rec.maxStreak > 0 ? 'rgba(88, 166, 255, 0.08)' : colors.ghSurface, borderWidth: 1, borderColor: rec.maxStreak > 0 ? 'rgba(88, 166, 255, 0.25)' : colors.ghBorder, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, fontWeight: '800', color: rec.maxStreak > 0 ? colors.ghBlue : colors.ghMuted }}>
                        {rec.maxStreak}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.ghMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Best Streak</Text>
                      <Text style={{ fontSize: 9, color: colors.ghMuted, marginTop: 2 }}>All-time record</Text>
                    </View>
                  </View>

                  {/* Dot Grid — last 28 occurrences */}
                  {dotHistory.length > 0 && (
                    <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 10 }]}>HISTORY GRID</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                        {dotHistory.map((entry, i) => {
                          const dotColor = entry.completed ? '#3fb950' : entry.missed ? '#f85149' : colors.ghBorder2;
                          const dotBg = entry.completed ? 'rgba(63,185,80,0.15)' : entry.missed ? 'rgba(248,81,73,0.15)' : 'transparent';
                          return (
                            <View
                              key={entry.id}
                              style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: dotBg, borderWidth: 1.5, borderColor: dotColor, alignItems: 'center', justifyContent: 'center' }}
                            >
                              {entry.completed && <Text style={{ fontSize: 9, color: '#3fb950' }}>✓</Text>}
                              {entry.missed && <Text style={{ fontSize: 8, color: '#f85149' }}>✗</Text>}
                            </View>
                          );
                        })}
                      </View>
                      {/* Legend */}
                      <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3fb950' }} />
                          <Text style={{ fontSize: 10, color: colors.ghMuted }}>Completed</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#f85149' }} />
                          <Text style={{ fontSize: 10, color: colors.ghMuted }}>Missed</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Completion History List */}
                  {history.length > 0 ? (
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.ghMuted, marginBottom: 10 }]}>RECURRENCE LOG</Text>
                      <View style={{ gap: 8 }}>
                        {[...history].reverse().map((entry) => (
                          <View
                            key={entry.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: colors.ghSurface,
                              borderWidth: 1,
                              borderColor: entry.completed ? 'rgba(63,185,80,0.2)' : entry.missed ? 'rgba(248,81,73,0.2)' : colors.ghBorder,
                              borderRadius: 10,
                              padding: 12,
                              gap: 10,
                            }}
                          >
                            {/* Status dot */}
                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: entry.completed ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 13 }}>{entry.completed ? '✅' : '❌'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.ghText, fontSize: 12, fontWeight: '600' }}>
                                Due: {fmtPeriodDate(entry.periodDue)}
                              </Text>
                              <Text style={{ color: colors.ghMuted, fontSize: 11, marginTop: 1 }}>
                                {entry.completed
                                  ? `Completed ${entry.completedAt ? fmtRelativeTime(entry.completedAt) : ''}`
                                  : 'Missed — deadline passed'}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: entry.completed ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: entry.completed ? '#3fb950' : '#f85149' }}>
                                {entry.completed ? 'DONE' : 'MISSED'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.ghSurface, borderWidth: 1, borderColor: colors.ghBorder, borderRadius: 12, padding: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, marginBottom: 8 }}>🎯</Text>
                      <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>No completions yet</Text>
                      <Text style={{ color: colors.ghMuted, fontSize: 12, textAlign: 'center' }}>Complete this task before the due date to start your streak!</Text>
                    </View>
                  )}

                  <View style={{ height: 1, backgroundColor: colors.ghBorder, marginVertical: 16 }} />
                </View>
              );
            })()}

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
                  } else if (entry.action === "notes_updated") {
                    detailsText = entry.details?.notePreview ? `"${entry.details.notePreview}"` : "(empty)";
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

      <ConfirmationModal
        visible={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={() => onToggleDone(task.id)}
        title="Task Completed"
        description="Are you sure you want to mark this task as complete?"
        warningNote="Note: This change is irreversible."
        colors={colors}
        successText="Task Completed!"
      />
      
      <ConfirmationModal
        visible={!!subtaskToConfirm}
        onClose={() => setSubtaskToConfirm(null)}
        onConfirm={() => {
          if (subtaskToConfirm) handleToggleSubtask(subtaskToConfirm);
          setSubtaskToConfirm(null);
        }}
        title="Complete Subtask"
        description={`Mark "${subtasks.find(s => s.id === subtaskToConfirm)?.title}" as completed?`}
        colors={colors}
        successText="Subtask Completed!"
      />
      
      <AddSubtaskModal
        visible={isAddSubtaskModalOpen}
        onClose={() => setIsAddSubtaskModalOpen(false)}
        onAdd={handleAddSubtask}
        colors={colors}
      />

      <TaskOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        isMuted={!!task.muted}
        onUpdate={() => {
          setOptionsModalVisible(false);
          if (onEditTask) onEditTask(task);
        }}
        onDelete={() => {
          setOptionsModalVisible(false);
          if (onDeleteTask) onDeleteTask(task.id);
        }}
        onToggleMute={() => {
          setOptionsModalVisible(false);
          onUpdateTask({ ...task, muted: !task.muted });
        }}
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
  // Mobile header: pan on handle/title; 3-dots is a non-overlapping flex sibling
  headerBlock: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 15,
    paddingRight: 8,
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
    flexShrink: 0,
  },
  optionsBtn: {
    width: 44,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
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
    flexShrink: 1,
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
