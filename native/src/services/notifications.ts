import { Task } from '../components/DetailPanel';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import * as EidonAlarm from '../../modules/expo-eidon-alarm';

export interface ReminderNotification {
  taskId: string;
  taskTitle: string;
  message: string;
  dueDate: string;
}

/**
 * Get the END-of-day timestamp for a YYYY-MM-DD string.
 * Used as the "stop reminding" cutoff — once the due date is over, reminders cease.
 */
function getDueEndOfDay(dueDateStr: string): number {
  const [y, m, d] = dueDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/**
 * Format a 24h time string (e.g. "14:30" or "09:00") into 12h AM/PM format ("2:30 PM", "9:00 AM").
 */
function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Format a time duration in ms to a human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) {
    const hours = Math.round(ms / 3_600_000);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.round(ms / 86_400_000);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Scan all tasks and return an array of notifications that should fire RIGHT NOW.
 */
export function checkReminders(tasks: Task[]): ReminderNotification[] {
  const now = Date.now();
  const notifications: ReminderNotification[] = [];

  for (const task of tasks) {
    if (task.done) continue;
    if (!task.due || !task.reminder) continue;
    if (task.reminder.dismissed) continue;
    if (task.muted) continue;

    const dueEndOfDay = getDueEndOfDay(task.due);

    let targetDueTime: number;
    if (task.dueTime) {
      const [y, m, d] = task.due.split('-').map(Number);
      const [h, min] = task.dueTime.split(':').map(Number);
      targetDueTime = new Date(y, m - 1, d, h, min, 0, 0).getTime();
    } else {
      // Default to start of day (midnight) for the reference due time
      // so that reminders without time trigger immediately if due today.
      const [y, m, d] = task.due.split('-').map(Number);
      targetDueTime = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    }

    // When should reminders start? (may be in the past → fire immediately)
    const reminderStartTime = targetDueTime - task.reminder.remindBefore;

    // Not yet in the reminder window
    if (now < reminderStartTime) continue;

    const lastNotified = task.reminder.lastNotifiedAt || 0;

    const isDayOverdue = now > dueEndOfDay;
    const dayOverdueTime = Math.abs(dueEndOfDay - now);

    if (lastNotified === 0) {
      // First notification — always fire
      const timeLeft = targetDueTime - now;
      const isOverdue = timeLeft < 0;
      const absTimeLeft = Math.abs(timeLeft);
      notifications.push({
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.due,
        message: task.dueTime
          ? (isOverdue ? `Overdue by ${formatDuration(absTimeLeft)}` : `Due at ${formatTime12h(task.dueTime)} (${formatDuration(absTimeLeft)} left)`)
          : (isDayOverdue ? `Overdue by ${formatDuration(dayOverdueTime)}` : `Due in ${formatDuration(dueEndOfDay - now)}`),
      });
    } else if (task.reminder.repeatEvery && task.reminder.repeatEvery > 0) {
      // Repeating — check if enough time has passed since last notification
      const elapsed = now - lastNotified;
      if (elapsed >= task.reminder.repeatEvery) {
        const timeLeft = targetDueTime - now;
        const isOverdue = timeLeft < 0;
        const absTimeLeft = Math.abs(timeLeft);
        notifications.push({
          taskId: task.id,
          taskTitle: task.title,
          dueDate: task.due,
          message: task.dueTime
            ? (isOverdue ? `Overdue by ${formatDuration(absTimeLeft)} — reminder` : `Due at ${formatTime12h(task.dueTime)} (${formatDuration(absTimeLeft)} left) — reminder`)
            : (isDayOverdue ? `Overdue by ${formatDuration(dayOverdueTime)} — reminder` : `Due in ${formatDuration(dueEndOfDay - now)} — reminder`),
        });
      }
    }
  }

  return notifications;
}

/**
 * Validate whether a remind-before value is feasible given the due date.
 * Returns an error message if invalid, or null if valid.
 */
export function validateReminder(
  dueDateStr: string,
  dueTimeStr: string | undefined,
  remindBeforeMs: number,
): string | null {
  const now = Date.now();
  let targetDueTime: number;
  if (dueTimeStr) {
    const [y, m, d] = dueDateStr.split('-').map(Number);
    const [h, min] = dueTimeStr.split(':').map(Number);
    targetDueTime = new Date(y, m - 1, d, h, min, 0, 0).getTime();
  } else {
    targetDueTime = getDueEndOfDay(dueDateStr);
  }

  if (targetDueTime <= now) {
    return 'Due date/time has already passed.';
  }

  return null;
}

/**
 * Cancel all natively scheduled notifications for a given task.
 */
export async function cancelTaskNotifications(taskId: string) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith(taskId + '_')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    if (Platform.OS === 'android') {
      try {
        EidonAlarm.cancelAlarm(taskId);
      } catch (e) {
        console.warn('Failed to cancel EidonAlarm:', e);
      }
    }
  } catch (err) {
    console.error('Failed to cancel notifications for task:', taskId, err);
  }
}

/**
 * Sync natively scheduled notifications for a given task.
 * Cancels old ones and schedules new ones if the task has an active reminder.
 */
export async function syncTaskNotifications(task: Task): Promise<{ success: boolean; error?: string }> {
  await cancelTaskNotifications(task.id);

  if (task.done || !task.due || !task.reminder || task.reminder.dismissed || task.muted) {
    return { success: true };
  }

  const now = Date.now();
  const dueEndOfDay = getDueEndOfDay(task.due);

  let targetDueTime: number;
  if (task.dueTime) {
    const [y, m, d] = task.due.split('-').map(Number);
    const [h, min] = task.dueTime.split(':').map(Number);
    targetDueTime = new Date(y, m - 1, d, h, min, 0, 0).getTime();
  } else {
    const [y, m, d] = task.due.split('-').map(Number);
    targetDueTime = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }

  const reminderStartTime = targetDueTime - task.reminder.remindBefore;
  
  let scheduleTime = reminderStartTime;
  
  // If the reminder start time is in the past, maybe skip to the next repeat or schedule right now
  const SAFETY_BUFFER = 2000;
  if (scheduleTime <= now + SAFETY_BUFFER) {
    if (!task.reminder.repeatEvery) {
      scheduleTime = now + SAFETY_BUFFER;
    } else {
      while (scheduleTime <= now + SAFETY_BUFFER) {
        scheduleTime += task.reminder.repeatEvery;
      }
    }
  }

  const settings = await api.getSettings();
  const useNativeAlarm = Platform.OS === 'android' && settings.reminderStyle === 'fullscreen';

  // Schedule up to 10 repeating notifications
  let count = 0;
  while (count < 10) {
    const timeLeft = targetDueTime - scheduleTime;
    const isOverdue = timeLeft < 0;
    const absTimeLeft = Math.abs(timeLeft);
    const isDayOverdue = scheduleTime > dueEndOfDay;
    const dayOverdueTime = Math.abs(dueEndOfDay - scheduleTime);

    const message = task.dueTime
      ? (isOverdue ? `Overdue by ${formatDuration(absTimeLeft)}` : `Due at ${formatTime12h(task.dueTime)} (${formatDuration(absTimeLeft)} left)`) + (count > 0 ? ' — reminder' : '')
      : (isDayOverdue ? `Overdue by ${formatDuration(dayOverdueTime)}` : `Due in ${formatDuration(dueEndOfDay - scheduleTime)}`) + (count > 0 ? ' — reminder' : '');

    try {
      if (useNativeAlarm) {
        // Just schedule the first one with AlarmManager for the true alarm experience.
        // AlarmManager will wake the device, so we only need the exact next trigger.
        if (count === 0) {
          EidonAlarm.scheduleAlarm(task.id, scheduleTime);
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          identifier: `${task.id}_${count}`,
          content: {
            title: task.title,
            body: message,
            sound: true,
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(scheduleTime),
            channelId: 'default',
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to schedule notification', err);
      return { success: false, error: err?.message || String(err) };
    }

    count++;
    if (!task.reminder.repeatEvery || task.reminder.repeatEvery <= 0 || useNativeAlarm) {
      break; // Native alarms loop internally until dismissed, no need to schedule 10!
    }
    scheduleTime += task.reminder.repeatEvery;
  }

  return { success: true };
}

