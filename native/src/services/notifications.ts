import { Task } from '../components/DetailPanel';

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

    const dueEndOfDay = getDueEndOfDay(task.due);

    // Due date has completely passed (end of day) — stop all reminders
    if (now >= dueEndOfDay) continue;

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

    // If exact due time has passed, and they did specify a time, stop reminding for it.
    if (task.dueTime && now >= targetDueTime) continue;

    const lastNotified = task.reminder.lastNotifiedAt || 0;

    if (lastNotified === 0) {
      // First notification — always fire
      const timeLeft = Math.max(0, targetDueTime - now);
      notifications.push({
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.due,
        message: task.dueTime
          ? `Due at ${task.dueTime} (${formatDuration(timeLeft)} left)`
          : `Due in ${formatDuration(dueEndOfDay - now)}`,
      });
    } else if (task.reminder.repeatEvery && task.reminder.repeatEvery > 0) {
      // Repeating — check if enough time has passed since last notification
      const elapsed = now - lastNotified;
      if (elapsed >= task.reminder.repeatEvery) {
        const timeLeft = Math.max(0, targetDueTime - now);
        notifications.push({
          taskId: task.id,
          taskTitle: task.title,
          dueDate: task.due,
          message: task.dueTime
            ? `Due at ${task.dueTime} (${formatDuration(timeLeft)} left) — reminder`
            : `Due in ${formatDuration(dueEndOfDay - now)} — reminder`,
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
