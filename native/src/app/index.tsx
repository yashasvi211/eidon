import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  AppState,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Sidebar from "../components/Sidebar";
import TaskPanel from "../components/TaskPanel";
import DetailPanel, {
  Task,
  Session,
  AuditEntry,
  RecurrenceConfig,
  StreakEntry,
} from "../components/DetailPanel";
import DeepStats from "../components/DeepStats";
import TimeTracking from "../components/TimeTracking";
import ScheduledView from "../components/ScheduledView";
import { Colors } from "../constants/theme";
import Header from "../components/Header";
import AddTaskModal from "../components/AddTaskModal";
import type { ReminderConfig, TaskRecurrenceConfig } from "../components/AddTaskModal";
import NotificationBanner, { NotificationData } from "../components/NotificationBanner";
import FullScreenReminder from "../components/FullScreenReminder";
import { syncTaskNotifications, cancelTaskNotifications } from "../services/notifications";
import * as Notifications from 'expo-notifications';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  withRepeat,
} from "react-native-reanimated";
import { api } from "../services/api";
import * as EidonAlarm from "../../modules/expo-eidon-alarm";

// ─── Recurrence Helpers ──────────────────────────────────────────────────────

/** Given a YYYY-MM-DD date string and a frequency, return the next period's due date string */
function advanceRecurringTaskDue(currentDue: string, frequency: 'daily' | 'weekly' | 'monthly'): string {
  const [y, m, d] = currentDue.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Called on app load. Checks all recurring tasks for missed deadlines:
 * If a recurring task's due date has passed and it's NOT yet done,
 * records a missed entry, resets the streak, and advances the due date.
 * If it IS done but the due date has passed, records a completed entry and advances.
 */
function processRecurrenceMissedDeadlines(tasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return tasks.map(task => {
    if (!task.recurrence || !task.due) return task;
    const rec = task.recurrence;

    // If due date is today or future, nothing to process
    if (task.due >= todayStr) return task;

    // Due date is in the past (< todayStr). Loop until due >= todayStr!
    let currDue = task.due;
    let newCurrentStreak = rec.currentStreak;
    let newMaxStreak = rec.maxStreak;
    let newHistory = [...(rec.history || [])];
    let isDone = task.done;
    let completedAt = task.completedAt;

    while (currDue < todayStr) {
      const alreadyRecorded = newHistory.some(e => e.periodDue === currDue);
      if (!alreadyRecorded) {
        const newEntry: StreakEntry = {
          id: `se_${Date.now()}_${Math.random().toString(36).slice(2)}_${currDue}`,
          periodDue: currDue,
          completed: isDone,
          completedAt: isDone ? (completedAt ?? undefined) : undefined,
          missed: !isDone,
        };
        newHistory.push(newEntry);

        if (isDone) {
          newCurrentStreak += 1;
          newMaxStreak = Math.max(newMaxStreak, newCurrentStreak);
        } else {
          newCurrentStreak = 0; // Missed! Break streak!
        }
      }
      // Once we process one cycle, subsequent missed cycles in the loop are not 'done'
      isDone = false;
      completedAt = null;
      currDue = advanceRecurringTaskDue(currDue, rec.frequency);
    }

    return {
      ...task,
      due: currDue,
      done: false,
      completedAt: null,
      recurrence: {
        ...rec,
        currentStreak: newCurrentStreak,
        maxStreak: newMaxStreak,
        history: newHistory,
      },
    };
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const settings = await api.getSettings();
    const isFullscreen = settings.reminderStyle === 'fullscreen';
    return {
      shouldShowAlert: !isFullscreen, // OS banner hidden if in fullscreen mode
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

const LoadingLine = ({ colors }: { colors: any }) => {
  const translateX = useSharedValue(-200);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(200, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.ghBg }}>
      <View style={{ width: 200, height: 3, backgroundColor: colors.ghBorder, borderRadius: 2, overflow: "hidden" }}>
        <Animated.View style={[{ width: '50%', height: "100%", backgroundColor: colors.ghBlue, borderRadius: 2 }, animatedStyle]} />
      </View>
      <Text style={{ marginTop: 16, color: colors.ghMuted, fontSize: 12, fontWeight: "600", letterSpacing: 1 }}>LOADING</Text>
    </View>
  );
};

export default function AppIndex() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const insets = useSafeAreaInsets();
  const touchStartX = useRef(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const SIDEBAR_WIDTH = 220;
  const sidebarTranslate = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  const DURATION = 350;

  const openSidebar = () => {
    setSidebarVisible(true);
    setIsSidebarOpen(true);
    sidebarTranslate.value = withTiming(0, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(1, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    sidebarTranslate.value = withTiming(-SIDEBAR_WIDTH, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(
      0,
      {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(setSidebarVisible)(false);
      },
    );
  };

  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslate.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const showErrorAlert = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => {
        setToastVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [currentView, setCurrentView] = useState("today");
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "details" | "checklist" | "timetracking" | "history"
  >("details");

  const [projects, setProjects] = useState<{ name: string; color: string }[]>([]);

  // Notification/reminder state
  const [activeNotification, setActiveNotification] = useState<NotificationData | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<NotificationData[]>([]);
  const tasksRef = useRef<Task[]>(tasks);

  // Keep ref in sync with tasks state
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Reminder settings state
  const [reminderStyle, setReminderStyle] = useState<'banner' | 'fullscreen'>('banner');
  const [reminderRequireAuth, setReminderRequireAuth] = useState(false);
  const [fullScreenNotification, setFullScreenNotification] = useState<NotificationData | null>(null);
  const reminderStyleRef = useRef<'banner' | 'fullscreen'>('banner');

  // Keep ref in sync
  useEffect(() => { reminderStyleRef.current = reminderStyle; }, [reminderStyle]);

  // Pop next notification from queue when current one is dismissed
  useEffect(() => {
    if (!activeNotification && notificationQueue.length > 0) {
      setActiveNotification(notificationQueue[0]);
      setNotificationQueue(prev => prev.slice(1));
    }
  }, [activeNotification, notificationQueue]);

  // Check for native Alarm Fired (Deep Android Alarm)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    const interval = setInterval(async () => {
      const enqueuedTaskId = EidonAlarm.getEnqueuedAlarm();
      if (enqueuedTaskId) {
        // Find task
        const task = tasksRef.current.find(t => t.id === enqueuedTaskId);
        const currentSettings = await api.getSettings();
        
        setFullScreenNotification(prev => {
          if (prev?.taskId === enqueuedTaskId) return prev;
          return {
            taskId: enqueuedTaskId,
            taskTitle: task?.title || 'Reminder',
            message: 'Time to focus!',
            dueDate: task?.due || '',
          };
        });
        setReminderStyle('fullscreen');
        setReminderRequireAuth(currentSettings.reminderRequireAuth || false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSyncNotifications = async (task: Task) => {
    try {
      const res = await syncTaskNotifications(task);
      if (task.reminder) {
        const currentStatus = task.reminder.lastNotificationStatus;
        const currentError = task.reminder.lastNotificationError;
        
        const newStatus = res.success ? 'success' : 'failed';
        const newError = res.success ? undefined : res.error;
        
        if (currentStatus !== newStatus || currentError !== newError) {
          const updatedReminder = {
            ...task.reminder,
            lastNotificationStatus: newStatus as 'success' | 'failed',
            lastNotificationError: newError,
            lastNotificationTime: Date.now(),
          };
          const updatedTask = { ...task, reminder: updatedReminder };
          
          setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
          await api.updateTask(task.id, { reminder: updatedReminder });
        }
      }
    } catch (err) {
      console.error("Failed to sync notifications:", err);
    }
  };

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(async notification => {
      const { request } = notification;
      const notifId = request.identifier;
      const parts = notifId.split('_');
      const taskId = parts[0];
      
      const allTasks = tasksRef.current;
      const existingTask = allTasks.find(t => t.id === taskId);
      if (existingTask && existingTask.reminder) {
        const updatedReminder = {
          ...existingTask.reminder,
          lastNotifiedAt: Date.now(),
          lastNotificationStatus: 'success' as const,
          lastNotificationError: undefined,
          lastNotificationTime: Date.now(),
          lastNotificationId: notifId,
        };
        const updatedTask = { ...existingTask, reminder: updatedReminder };
        
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        await api.updateTask(taskId, { reminder: updatedReminder }).catch(err => {
          console.error('Failed to update notification delivery status in DB:', err);
        });
        
        // Replenish notification scheduling window
        await handleSyncNotifications(updatedTask);
      }

      // Show in-app reminder based on style setting
      // Read fresh settings to ensure we use the latest reminderStyle
      const currentSettings = await api.getSettings();
      const currentStyle = currentSettings.reminderStyle || 'banner';

      const { title, body } = request.content;
      const task = tasksRef.current.find(t => t.id === taskId);
      const newNotification: NotificationData = {
        taskId,
        taskTitle: title || task?.title || 'Reminder',
        message: body || '',
        dueDate: task?.due || '',
      };

      if (currentStyle === 'fullscreen') {
        // Full-screen alarm mode — don't fire if one is already active
        setFullScreenNotification(prev => {
          if (prev) return prev; // Already showing a reminder, skip this one
          return newNotification;
        });
        // Also sync the local state
        setReminderStyle(currentSettings.reminderStyle || 'banner');
        setReminderRequireAuth(currentSettings.reminderRequireAuth || false);
      } else {
        // Banner mode (existing behavior)
        setNotificationQueue(prev => [...prev, newNotification]);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const { request } = response.notification;
      const notifId = request.identifier;
      const taskId = notifId.split('_')[0];

      const allTasks = tasksRef.current;
      const existingTask = allTasks.find(t => t.id === taskId);
      if (existingTask && existingTask.reminder) {
        const updatedReminder = {
          ...existingTask.reminder,
          lastNotifiedAt: Date.now(),
          lastNotificationStatus: 'success' as const,
          lastNotificationError: undefined,
          lastNotificationTime: Date.now(),
          lastNotificationId: notifId,
        };
        const updatedTask = { ...existingTask, reminder: updatedReminder };
        
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        await api.updateTask(taskId, { reminder: updatedReminder }).catch(err => {
          console.error('Failed to update notification tap success in DB:', err);
        });
        
        // Replenish notification scheduling window
        await handleSyncNotifications(updatedTask);
      }

      // Check settings to see if we should show the full screen reminder
      const currentSettings = await api.getSettings();
      const currentStyle = currentSettings.reminderStyle || 'banner';

      if (currentStyle === 'fullscreen') {
        const { title, body } = request.content;
        const task = tasksRef.current.find(t => t.id === taskId);
        // Don't fire if an alarm is already active
        setFullScreenNotification(prev => {
          if (prev) return prev;
          return {
            taskId,
            taskTitle: title || task?.title || 'Reminder',
            message: body || '',
            dueDate: task?.due || '',
          };
        });
        setReminderStyle(currentSettings.reminderStyle || 'banner');
        setReminderRequireAuth(currentSettings.reminderRequireAuth || false);
      } else {
        setSelectedTaskId(taskId);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Sleep mode state
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(
    null,
  );
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(
    null,
  );

  // Live stopwatch ticks
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && activeTimerTaskId) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, activeTimerTaskId]);

  // Load tasks, projects, and settings on mount, plus register notifications
  useEffect(() => {
    async function loadInitialData() {
      try {
        await api.init();
        const fetchedTasks = await api.getTasks();
        const fetchedProjects = await api.getProjects();
        const fetchedSettings = await api.getSettings();

        setTasks(fetchedTasks || []);
        setProjects(fetchedProjects || []);
        if (fetchedSettings) {
          setIsSleeping(fetchedSettings.isSleeping);
          setSleepStartTime(fetchedSettings.sleepStartTime);
          setReminderStyle(fetchedSettings.reminderStyle || 'banner');
          setReminderRequireAuth(fetchedSettings.reminderRequireAuth || false);
        }

        // Process any recurring tasks whose deadlines have passed
        if (fetchedTasks) {
          const processedTasks = processRecurrenceMissedDeadlines(fetchedTasks);
          const changed = processedTasks.some((t, i) => {
            const orig = fetchedTasks[i];
            return t.due !== orig.due || t.done !== orig.done || JSON.stringify(t.recurrence) !== JSON.stringify(orig.recurrence);
          });
          if (changed) {
            setTasks(processedTasks);
            // Persist the changes
            for (const task of processedTasks) {
              const orig = fetchedTasks.find(t => t.id === task.id);
              if (orig && (task.due !== orig.due || task.done !== orig.done || JSON.stringify(task.recurrence) !== JSON.stringify(orig.recurrence))) {
                api.updateTask(task.id, { due: task.due, done: task.done, completedAt: task.completedAt, recurrence: task.recurrence }).catch(err =>
                  console.error('Failed to persist recurrence update:', err)
                );
              }
            }
          }
        }

        if (fetchedTasks) {
          // Re-sync notifications on app startup to replenish the 10 scheduled slots
          for (const task of fetchedTasks) {
            if (!task.done && task.reminder && !task.reminder.dismissed) {
              syncTaskNotifications(task).catch(err => {
                console.error("Failed to sync notifications on startup for task:", task.id, err);
              });
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to load data:", err);
        showErrorAlert(
          "Load Failed",
          `Could not load data.\n\n${err?.message || err}`
        );
      } finally {
        setIsAppLoading(false);
      }
    }

    async function registerForPushNotificationsAsync() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get permissions for local notifications!');
      }
    }

    loadInitialData();
    registerForPushNotificationsAsync();
  }, []);

  // Check recurring task deadlines when app returns to foreground from background/sleep
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setTasks((prev) => {
          if (!prev || prev.length === 0) return prev;
          const processed = processRecurrenceMissedDeadlines(prev);
          const changed = processed.some((t, i) => {
            const orig = prev[i];
            return t.due !== orig.due || t.done !== orig.done || JSON.stringify(t.recurrence) !== JSON.stringify(orig.recurrence);
          });
          if (changed) {
            for (const task of processed) {
              const orig = prev.find(t => t.id === task.id);
              if (orig && (task.due !== orig.due || task.done !== orig.done || JSON.stringify(task.recurrence) !== JSON.stringify(orig.recurrence))) {
                api.updateTask(task.id, { due: task.due, done: task.done, completedAt: task.completedAt, recurrence: task.recurrence }).catch(err =>
                  console.error('Failed to persist recurrence update on app resume:', err)
                );
              }
            }
            return processed;
          }
          return prev;
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Check Android alarm permissions when reminderStyle changes to fullscreen
  useEffect(() => {
    if (Platform.OS !== 'android' || reminderStyle !== 'fullscreen') return;

    const checkPermissions = async () => {
      try {
        const hasOverlay = EidonAlarm.canDrawOverlays();
        const hasExactAlarm = EidonAlarm.canScheduleExactAlarms();

        if (!hasOverlay) {
          Alert.alert(
            'Permission Required',
            'To show full-screen reminders even when the app is closed, Eidon needs the "Display over other apps" permission.\n\nPlease enable it in the next screen.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => EidonAlarm.openOverlaySettings(),
              },
            ]
          );
        } else if (!hasExactAlarm) {
          Alert.alert(
            'Permission Required',
            'To schedule precise alarm reminders, Eidon needs the "Alarms & reminders" permission.\n\nPlease enable it in the next screen.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => EidonAlarm.openExactAlarmSettings(),
              },
            ]
          );
        }
      } catch (e) {
        console.warn('Permission check failed:', e);
      }
    };

    checkPermissions();
  }, [reminderStyle]);

  // Start auto-sync if enabled
  useEffect(() => {
    api.startAutoSync();
    return () => api.stopAutoSync();
  }, []);

  // Handle sleep mode transitions
  useEffect(() => {
    const nextStart = isSleeping ? Date.now() : null;
    setSleepStartTime(nextStart);
    api.updateSettings({ isSleeping, sleepStartTime: nextStart })
      .catch((err) => console.error("Failed to save sleep settings:", err));
  }, [isSleeping]);

  // Derived selected task
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const [activeMobileTask, setActiveMobileTask] = useState<Task | null>(null);

  useEffect(() => {
    if (selectedTask) {
      setActiveMobileTask(selectedTask);
    }
  }, [selectedTask]);

  useEffect(() => {
    setActiveTab("details");
  }, [selectedTaskId]);

  const toggleDone = (id: string) => {
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    if (!taskToToggle.done) {
      const hasUncompletedSubtasks = (taskToToggle.subtasks || []).some(
        (sub) => !sub.done
      );
      if (hasUncompletedSubtasks) {
        showErrorAlert(
          "Cannot Complete Task",
          "You must complete all subtasks before marking this task as completed."
        );
        return;
      }
    }

    const isRecurring = !!taskToToggle.recurrence;
    const completingNow = !taskToToggle.done; // true = we're marking as done

    // For recurring tasks, completing means: record in history + advance due date + reset done flag
    if (isRecurring && completingNow && taskToToggle.due) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (taskToToggle.due > todayStr) {
        showErrorAlert(
          "Task Not Due Yet",
          `This recurring task is scheduled for ${taskToToggle.due}. You can only complete it on or after its scheduled date to maintain your streak.`
        );
        return;
      }

      const rec = taskToToggle.recurrence!;
      const nowTs = Date.now();

      const newEntry: StreakEntry = {
        id: `se_${nowTs}_${Math.random().toString(36).slice(2)}`,
        periodDue: taskToToggle.due,
        completed: true,
        completedAt: nowTs,
        missed: false,
      };

      const newCurrentStreak = rec.currentStreak + 1;
      const newMaxStreak = Math.max(rec.maxStreak, newCurrentStreak);
      const nextDue = advanceRecurringTaskDue(taskToToggle.due, rec.frequency);

      const auditEntry: AuditEntry = {
        timestamp: nowTs,
        action: 'completed',
      };

      const updatedTask: Task = {
        ...taskToToggle,
        done: false,          // recurring tasks reset to not-done immediately
        completedAt: null,
        due: nextDue,         // advance to next period
        auditLog: [...(taskToToggle.auditLog || []), auditEntry],
        recurrence: {
          ...rec,
          currentStreak: newCurrentStreak,
          maxStreak: newMaxStreak,
          history: [...(rec.history || []), newEntry],
        },
      };

      const previousTasks = tasks;
      setTasks(tasks.map(t => t.id !== id ? t : updatedTask));

      api.updateTask(id, {
        done: false,
        completedAt: null,
        due: nextDue,
        recurrence: updatedTask.recurrence,
      })
        .then(() => api.createAuditLog(id, auditEntry))
        .catch((err: any) => {
          console.error('Failed to update recurring task:', err);
          setTasks(previousTasks);
          showErrorAlert('Save Failed', `Could not save.\n\n${err?.message || err}`);
        });
      return;
    }

    const isDone = !taskToToggle.done;
    const completedAt = isDone ? Date.now() : null;
    const auditEntry: AuditEntry = {
      timestamp: Date.now(),
      action: isDone ? "completed" : "uncompleted",
    };

    const previousTasks = tasks;
    setTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          done: isDone,
          completedAt,
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      }),
    );

    api.updateTask(id, { done: isDone, completedAt })
      .then(() => {
        if (isDone) cancelTaskNotifications(id);
        else handleSyncNotifications({ ...tasks.find(t => t.id === id)!, done: isDone, completedAt });
        return api.createAuditLog(id, auditEntry);
      })
      .catch((err: any) => {
        console.error("Failed to update task:", err);
        setTasks(previousTasks);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const oldTask = tasks.find((t) => t.id === updatedTask.id);
    if (!oldTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
      return;
    }

    const previousTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    );

    // Sync task fields updates
    const fieldsChanged =
      oldTask.title !== updatedTask.title ||
      oldTask.due !== updatedTask.due ||
      oldTask.dueTime !== updatedTask.dueTime ||
      oldTask.est !== updatedTask.est ||
      oldTask.notes !== updatedTask.notes ||
      oldTask.project !== updatedTask.project ||
      oldTask.target !== updatedTask.target ||
      oldTask.done !== updatedTask.done ||
      oldTask.completedAt !== updatedTask.completedAt ||
      JSON.stringify(oldTask.recurrence) !== JSON.stringify(updatedTask.recurrence);

    const syncPromises: Promise<any>[] = [];

    if (fieldsChanged) {
      syncPromises.push(
        api.updateTask(updatedTask.id, {
          title: updatedTask.title,
          project: updatedTask.project,
          due: updatedTask.due,
          dueTime: updatedTask.dueTime,
          est: updatedTask.est,
          notes: updatedTask.notes,
          done: updatedTask.done,
          completedAt: updatedTask.completedAt,
          target: updatedTask.target,
          reminder: updatedTask.reminder,
          recurrence: updatedTask.recurrence,
        })
      );
    }

    // Sync subtask additions/updates/deletions
    const oldSubtasks = oldTask.subtasks || [];
    const newSubtasks = updatedTask.subtasks || [];

    // Find added subtasks
    const addedSubtasks = newSubtasks.filter(
      (n) => !oldSubtasks.some((o) => o.id === n.id)
    );
    for (const sub of addedSubtasks) {
      syncPromises.push(api.createSubtask(updatedTask.id, sub));
    }

    // Find modified subtasks
    const modifiedSubtasks = newSubtasks.filter((n) => {
      const oldSub = oldSubtasks.find((o) => o.id === n.id);
      return oldSub && (oldSub.done !== n.done || oldSub.title !== n.title);
    });
    for (const sub of modifiedSubtasks) {
      syncPromises.push(
        api.updateSubtask(updatedTask.id, sub.id, {
          title: sub.title,
          done: sub.done,
        })
      );
    }

    // Find deleted subtasks
    const deletedSubtasks = oldSubtasks.filter(
      (o) => !newSubtasks.some((n) => n.id === o.id)
    );
    for (const sub of deletedSubtasks) {
      syncPromises.push(api.deleteSubtask(updatedTask.id, sub.id));
    }

    // Sync audit log additions
    const oldAudit = oldTask.auditLog || [];
    const newAudit = updatedTask.auditLog || [];
    const addedAudit = newAudit.slice(oldAudit.length);
    for (const entry of addedAudit) {
      syncPromises.push(api.createAuditLog(updatedTask.id, entry));
    }

    if (syncPromises.length > 0) {
      Promise.all(syncPromises).catch((err: any) => {
        console.error("Failed to save task updates:", err);
        setTasks(previousTasks);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
    }
    
    handleSyncNotifications(updatedTask);
  };

  const handleDeleteTask = (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const previousTasks = tasks;
          setTasks(tasks.filter(t => t.id !== taskId));
          if (selectedTaskId === taskId) {
            setSelectedTaskId(null);
          }
          api.deleteTask(taskId).catch((err: any) => {
            console.error("Failed to delete task:", err);
            setTasks(previousTasks);
            showErrorAlert("Delete Failed", `Could not delete.\n\n${err?.message || err}`);
          });
        }
      }
    ]);
  };

  const handleAddTask = (
    title: string,
    project: string = "Inbox",
    due?: string,
    reminderConfig?: ReminderConfig,
    dueTime?: string,
    priority?: 'High' | 'Moderate' | 'Low',
    execStartDate?: string,
    execStartTime?: string,
    recurrenceConfig?: TaskRecurrenceConfig,
  ) => {
    // For a new recurring task with no due date set, auto-assign today's date
    let taskDue = due;
    if (recurrenceConfig && !taskDue) {
      const now = new Date();
      taskDue = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }

    const recurrence: RecurrenceConfig | undefined = recurrenceConfig
      ? {
          frequency: recurrenceConfig.frequency,
          streakEnabled: recurrenceConfig.streakEnabled,
          currentStreak: 0,
          maxStreak: 0,
          history: [],
        }
      : undefined;

    const newTask: Task = {
      id: "t" + Date.now(),
      title,
      project,
      due: taskDue,
      dueTime,
      done: false,
      target:
        currentView === "backlog"
          ? "backlog"
          : currentView === "scheduled"
            ? "scheduled"
            : "today",
      subtasks: [],
      sessions: [],
      createdAt: Date.now(),
      auditLog: [
        {
          timestamp: Date.now(),
          action: "created",
        },
      ],
      reminder: reminderConfig
        ? { ...reminderConfig, lastNotifiedAt: 0, dismissed: false }
        : undefined,
      priority,
      execStartDate,
      execStartTime,
      recurrence,
    };

    api.createTask(newTask)
      .then(() => {
        setTasks((prev) => {
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [...prev, newTask];
        });
        handleSyncNotifications(newTask);
      })
      .catch((err: any) => {
        console.error("Failed to create task:", err);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const handleSaveEditTask = (
    taskToEdit: Task,
    title: string,
    project: string = "Inbox",
    due?: string,
    reminderConfig?: ReminderConfig,
    dueTime?: string,
    priority?: 'High' | 'Moderate' | 'Low',
    execStartDate?: string,
    execStartTime?: string,
    recurrenceConfig?: TaskRecurrenceConfig,
  ) => {
    const recurrence: RecurrenceConfig | undefined = recurrenceConfig
      ? {
          frequency: recurrenceConfig.frequency,
          streakEnabled: recurrenceConfig.streakEnabled,
          currentStreak: taskToEdit.recurrence?.currentStreak ?? 0,
          maxStreak: taskToEdit.recurrence?.maxStreak ?? 0,
          history: taskToEdit.recurrence?.history ?? [],
        }
      : undefined;

    const updatedTask: Task = {
      ...taskToEdit,
      title,
      project,
      due,
      dueTime,
      priority,
      execStartDate,
      execStartTime,
      reminder: reminderConfig
        ? { ...reminderConfig, lastNotifiedAt: taskToEdit.reminder?.lastNotifiedAt || 0, dismissed: taskToEdit.reminder?.dismissed || false }
        : undefined,
      recurrence,
    };
    handleUpdateTask(updatedTask);
  };

  const handleStartTimer = (taskId: string) => {
    setIsTimerRunning(true);
    setActiveTimerTaskId(taskId);
    setTimerSeconds(0);
    setTimerStartTimestamp(Date.now());

    // Audit log
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "timer_started",
    };

    const previousTasks = tasks;
    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          auditLog: [...(t.auditLog || []), audit],
        };
      }),
    );

    api.createAuditLog(taskId, audit)
      .catch((err: any) => {
        console.error("Failed to save timer audit log:", err);
        setTasks(previousTasks);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const handleStopTimer = (note: string) => {
    if (!activeTimerTaskId || !timerStartTimestamp) return;

    const start = timerStartTimestamp;
    const end = Date.now();
    const newSession: Session = {
      id: "sess" + Date.now(),
      start,
      end,
      note: note.trim() || undefined,
    };

    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "timer_stopped",
      details: {
        note: note.trim() || undefined,
      },
    };

    const previousTasks = tasks;
    setTasks(
      tasks.map((t) => {
        if (t.id !== activeTimerTaskId) return t;
        return {
          ...t,
          sessions: [...(t.sessions || []), newSession],
          auditLog: [...(t.auditLog || []), audit],
        };
      }),
    );

    const taskId = activeTimerTaskId;
    const prevIsTimerRunning = isTimerRunning;
    const prevActiveTimerTaskId = activeTimerTaskId;
    const prevTimerStartTimestamp = timerStartTimestamp;
    const prevTimerSeconds = timerSeconds;

    setIsTimerRunning(false);
    setActiveTimerTaskId(null);
    setTimerStartTimestamp(null);
    setTimerSeconds(0);

    api.createSession(taskId, newSession)
      .then(() => api.createAuditLog(taskId, audit))
      .catch((err: any) => {
        console.error("Failed to save timer session:", err);
        setTasks(previousTasks);
        setIsTimerRunning(prevIsTimerRunning);
        setActiveTimerTaskId(prevActiveTimerTaskId);
        setTimerStartTimestamp(prevTimerStartTimestamp);
        setTimerSeconds(prevTimerSeconds);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const handleAddProject = (name: string, color: string) => {
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      return;
    
    const previousProjects = projects;
    const previousCurrentProject = currentProject;
    const previousCurrentView = currentView;

    setProjects([...projects, { name, color }]);
    setCurrentProject(name);
    setCurrentView("today");

    api.createProject({ name, color })
      .catch((err: any) => {
        console.error("Failed to create project:", err);
        setProjects(previousProjects);
        setCurrentProject(previousCurrentProject);
        setCurrentView(previousCurrentView);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const handleDeleteProject = (name: string) => {
    const previousProjects = projects;
    const previousCurrentProject = currentProject;
    const previousCurrentView = currentView;
    const previousTasks = tasks;

    setProjects(projects.filter((p) => p.name !== name));
    if (currentProject === name) {
      setCurrentProject(null);
      setCurrentView("today");
    }
    setTasks(tasks.filter((t) => t.project !== name));

    api.deleteProject(name)
      .catch((err: any) => {
        console.error("Failed to delete project:", err);
        setProjects(previousProjects);
        setCurrentProject(previousCurrentProject);
        setCurrentView(previousCurrentView);
        setTasks(previousTasks);
        showErrorAlert("Save Failed", `Could not save.\n\n${err?.message || err}`);
      });
  };

  const reloadData = async () => {
    try {
      const fetchedTasks = await api.getTasks();
      const fetchedProjects = await api.getProjects();
      setTasks(fetchedTasks || []);
      setProjects(fetchedProjects || []);
    } catch (err: any) {
      console.error("Failed to reload data:", err);
    }
  };

  const closeSidebarMobile = () => {
    if (!isLargeScreen) {
      closeSidebar();
    }
  };

  const renderMiddlePanel = () => {
    if (currentView === "stats") {
      return <DeepStats tasks={tasks} />;
    }
    if (currentView === "timetracking") {
      return (
        <TimeTracking
          tasks={tasks}
          isSleeping={isSleeping}
          sleepStartTime={sleepStartTime}
          isTimerRunning={isTimerRunning}
          activeTimerTaskId={activeTimerTaskId}
          timerSeconds={timerSeconds}
        />
      );
    }
    if (currentView === "scheduled") {
      return (
        <ScheduledView
          tasks={tasks}
          onSelectTask={(t) => {
            setSelectedTaskId(t.id);
          }}
          showCompleted={showCompleted}
          onSwipeRight={!isLargeScreen ? openSidebar : undefined}
        />
      );
    }

    return (
      <TaskPanel
        tasks={tasks}
        projects={projects}
        currentView={currentView}
        currentProject={currentProject}
        toggleDone={toggleDone}
        onOpenDetail={(t) => {
          setSelectedTaskId(t.id);
        }}
        selectedTaskId={selectedTaskId}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
        setTasks={setTasks}
        onDeleteTask={handleDeleteTask}
      />
    );
  };

  const headerRight = (
    <TouchableOpacity
      style={[
        styles.addBtn,
        { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder },
      ]}
      onPress={() => setShowAddModal(true)}
    >
      <Text style={{ color: colors.ghText, fontSize: 12, fontWeight: "600" }}>
        + Add Task
      </Text>
    </TouchableOpacity>
  );

  const headerTitle =
    currentProject ||
    (currentView === "today"
      ? "Today"
      : currentView === "backlog"
        ? "Backlog"
        : currentView === "scheduled"
          ? "Scheduled"
          : currentView === "stats"
            ? "Deep Stats"
            : currentView === "timetracking"
              ? "Time Tracking"
              : currentView.charAt(0).toUpperCase() + currentView.slice(1));

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    if (isLargeScreen) return;
    const dx = e.nativeEvent.pageX - touchStartX.current;

    if (!selectedTaskId && touchStartX.current < 40 && dx > 60 && currentView !== "scheduled") {
      openSidebar();
    }
  };

  if (isAppLoading) {
    return <LoadingLine colors={colors} />;
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.ghBg }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Header
          title={headerTitle}
          showMenuBtn={!isLargeScreen}
          onMenuPress={() => openSidebar()}
          right={headerRight}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.appRow}>
            {isLargeScreen && (
              <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                currentProject={currentProject}
                setCurrentProject={setCurrentProject}
                projects={projects}
                onAddProject={handleAddProject}
                tasks={tasks}
                isSleeping={isSleeping}
                setIsSleeping={setIsSleeping}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
                onDeleteProject={handleDeleteProject}
                onDataChanged={reloadData}
              />
            )}

            {/* Task List / Stats / Time Tracking / Calendar Panel */}
            <View style={styles.middlePanel}>
              {renderMiddlePanel()}

              {/* Mobile Detail Panel — overlaid so task list stays rendered behind it */}
              {!isLargeScreen && !!selectedTaskId && !!activeMobileTask && (
                <View style={styles.mobileDetailOverlay}>
                  <DetailPanel
                    task={activeMobileTask}
                    onClose={() => setSelectedTaskId(null)}
                    onToggleDone={toggleDone}
                    onUpdateTask={handleUpdateTask}
                    onEditTask={(task) => setEditingTask(task)}
                    isTimerRunning={isTimerRunning}
                    timerSeconds={timerSeconds}
                    onStartTimer={handleStartTimer}
                    onStopTimer={handleStopTimer}
                    activeTimerTaskId={activeTimerTaskId}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                  />
                </View>
              )}
            </View>

            {/* Detail Panel for Large Screens */}
            {isLargeScreen && (
              <View style={styles.rightPanel}>
                <DetailPanel
                  task={selectedTask}
                  onClose={() => setSelectedTaskId(null)}
                  onToggleDone={toggleDone}
                  onUpdateTask={handleUpdateTask}
                  onEditTask={(task) => setEditingTask(task)}
                  isTimerRunning={isTimerRunning}
                  timerSeconds={timerSeconds}
                  onStartTimer={handleStartTimer}
                  onStopTimer={handleStopTimer}
                  activeTimerTaskId={activeTimerTaskId}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </View>
            )}
          </View>

        </View>
      </View>

      {/* Sidebar Overlay Drawer with slide-in animation for Mobile */}
      {!isLargeScreen && (sidebarVisible || isSidebarOpen) && (
        <View style={[styles.sidebarOverlay, { top: insets.top }]}>
          <Animated.View
            style={[styles.backdropContainer, backdropAnimatedStyle]}
          >
            <TouchableOpacity
              style={styles.backdrop}
              onPress={() => closeSidebar()}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.sidebarMobileContainer,
              { backgroundColor: colors.ghSurface },
              sidebarAnimatedStyle,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Sidebar
                currentView={currentView}
                setCurrentView={(v: string) => {
                  setCurrentView(v);
                  closeSidebarMobile();
                }}
                currentProject={currentProject}
                setCurrentProject={(p: string | null) => {
                  setCurrentProject(p);
                  closeSidebarMobile();
                }}
                projects={projects}
                onAddProject={handleAddProject}
                tasks={tasks}
                isSleeping={isSleeping}
                setIsSleeping={setIsSleeping}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
                onDeleteProject={handleDeleteProject}
              />
            </View>
          </Animated.View>
        </View>
      )}

      <AddTaskModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTask}
        projects={projects}
      />

      <AddTaskModal
        visible={editingTask !== null}
        onClose={() => setEditingTask(null)}
        onAdd={(title, project, due, reminder, dueTime, priority, execStartDate, execStartTime, recurrenceConfig) => {
          if (editingTask) {
            handleSaveEditTask(editingTask, title, project, due, reminder, dueTime, priority, execStartDate, execStartTime, recurrenceConfig);
          }
        }}
        projects={projects}
        initialTask={editingTask}
      />

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.errorOverlay}>
          <View
            style={[
              styles.errorModal,
              {
                backgroundColor: colors.ghSurface,
                borderColor: colors.ghRed,
              },
            ]}
          >
            <View style={styles.errorHeader}>
              <Feather name="alert-triangle" size={20} color={colors.ghRed} />
              <Text style={[styles.errorTitle, { color: colors.ghText }]}>
                {errorModalTitle}
              </Text>
            </View>
            <Text style={[styles.errorMessage, { color: colors.ghMuted }]}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              style={[
                styles.errorCloseBtn,
                { backgroundColor: colors.ghRed },
              ]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.errorCloseBtnText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toastVisible && (
        <View style={[styles.toastContainer, { backgroundColor: colors.ghGreen }]}>
          <Feather name="check" size={16} color="#ffffff" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Reminder Notification Banner */}
      <NotificationBanner
        notification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
        onPress={(taskId) => {
          setSelectedTaskId(taskId);
          setActiveNotification(null);
        }}
      />

      {/* Full-Screen Reminder */}
      <FullScreenReminder
        visible={!!fullScreenNotification}
        notification={fullScreenNotification}
        task={fullScreenNotification ? tasks.find(t => t.id === fullScreenNotification.taskId) || null : null}
        requireAuth={reminderRequireAuth}
        onDismiss={() => setFullScreenNotification(null)}
        onComplete={async (taskId: string, reflectionText: string) => {
          const audit: AuditEntry = {
            timestamp: Date.now(),
            action: 'reminder_triggered',
            details: {
              reminderResponse: reflectionText || undefined,
              reminderTriggerTime: Date.now(),
            },
          };
          setTasks(prev => prev.map(t => {
            if (t.id !== taskId) return t;
            return { ...t, auditLog: [...(t.auditLog || []), audit] };
          }));
          await api.createAuditLog(taskId, audit).catch(err => {
            console.error('Failed to save reminder reflection:', err);
          });
          setFullScreenNotification(null);
        }}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appRow: {
    flex: 1,
    flexDirection: "row",
  },
  middlePanel: {
    flex: 1,
    overflow: "hidden",
  },
  mobileDetailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  rightPanel: {
    width: 320,
    flexShrink: 0,
  },
  sidebarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 100,
  },
  backdropContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sidebarMobileContainer: {
    width: 220,
    height: "100%",
  },
  addBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  errorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  errorCloseBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCloseBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  toastContainer: {
    position: "absolute",
    bottom: 55,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 9999,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
