import * as fs from 'fs';

let content = fs.readFileSync('src/services/notifications.ts', 'utf8');

// Add import if missing
if (!content.includes("import * as Notifications from 'expo-notifications';")) {
  content = content.replace("import { Task } from '../components/DetailPanel';", "import { Task } from '../components/DetailPanel';\nimport * as Notifications from 'expo-notifications';");
}

// Append new functions
const newCode = `

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
  } catch (err) {
    console.error('Failed to cancel notifications for task:', taskId, err);
  }
}

/**
 * Sync natively scheduled notifications for a given task.
 * Cancels old ones and schedules new ones if the task has an active reminder.
 */
export async function syncTaskNotifications(task: Task) {
  await cancelTaskNotifications(task.id);

  if (task.done || !task.due || !task.reminder || task.reminder.dismissed) {
    return;
  }

  const now = Date.now();
  const dueEndOfDay = getDueEndOfDay(task.due);

  if (now >= dueEndOfDay) return;

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
  
  // If exact due time has passed, stop reminding
  if (task.dueTime && now >= targetDueTime) return;

  let scheduleTime = reminderStartTime;
  
  // If the reminder start time is in the past, maybe we should fire now or skip to the next repeat
  if (scheduleTime <= now) {
    if (!task.reminder.repeatEvery) {
      // It's in the past and doesn't repeat. Just fire once right now (or don't schedule if it was already notified? we don't know without lastNotifiedAt. But let's schedule for +2 seconds just in case they just created it).
      scheduleTime = now + 2000;
    } else {
      // Find the next repeat interval that is in the future
      while (scheduleTime <= now && scheduleTime < targetDueTime) {
        scheduleTime += task.reminder.repeatEvery;
      }
    }
  }

  // Schedule up to 10 repeating notifications to simulate repeatEvery (since expo doesn't support starting an interval at a specific future date)
  let count = 0;
  while (scheduleTime < targetDueTime && count < 10) {
    const timeLeft = Math.max(0, targetDueTime - scheduleTime);
    const message = task.dueTime
      ? \`Due at \${task.dueTime} (\${formatDuration(timeLeft)} left)\` + (count > 0 ? ' — reminder' : '')
      : \`Due in \${formatDuration(dueEndOfDay - scheduleTime)}\` + (count > 0 ? ' — reminder' : '');

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: \`\${task.id}_\${count}\`,
        content: {
          title: task.title,
          body: message,
          sound: true,
        },
        trigger: { date: new Date(scheduleTime) },
      });
    } catch (err) {
      console.error('Failed to schedule notification', err);
    }

    count++;
    if (!task.reminder.repeatEvery || task.reminder.repeatEvery <= 0) {
      break; // No repeat
    }
    scheduleTime += task.reminder.repeatEvery;
  }
}
`;

fs.writeFileSync('src/services/notifications.ts', content + newCode);
