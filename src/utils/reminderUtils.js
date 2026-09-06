export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

export const REMINDER_OFFSETS = [
  { label: '2 Minutes', value: 2 * MINUTE },
  { label: '15 Minutes', value: 15 * MINUTE },
  { label: '30 Minutes', value: 30 * MINUTE },
  { label: '1 Hour', value: HOUR },
  { label: '3 Hours', value: 3 * HOUR },
  { label: '6 Hours', value: 6 * HOUR },
  { label: '12 Hours', value: 12 * HOUR },
  { label: '1 Day', value: DAY },
  { label: '2 Days', value: 2 * DAY },
  { label: '3 Days', value: 3 * DAY },
  { label: '1 Week', value: WEEK },
  { label: '2 Weeks', value: 2 * WEEK },
  { label: '3 Weeks', value: 3 * WEEK },
  { label: '1 Month', value: 30 * DAY },
];

export const REPEAT_INTERVALS = [
  { label: 'Once', value: 0 },
  { label: '5 Minutes', value: 5 * MINUTE },
  { label: '10 Minutes', value: 10 * MINUTE },
  { label: '15 Minutes', value: 15 * MINUTE },
  { label: '30 Minutes', value: 30 * MINUTE },
  { label: '1 Hour', value: HOUR },
  { label: '2 Hours', value: 2 * HOUR },
  { label: '3 Hours', value: 3 * HOUR },
  { label: '4 Hours', value: 4 * HOUR },
  { label: '6 Hours', value: 6 * HOUR },
  { label: '12 Hours', value: 12 * HOUR },
  { label: '1 Day', value: DAY },
];

export const OVERDUE_REPEAT_OPTIONS = [
  { label: 'Every 2 mins', value: 120000 },
  { label: 'Every 3 hours', value: 10800000 },
  { label: 'Every 6 hours', value: 21600000 },
  { label: 'Every 12 hours', value: 43200000 },
  { label: 'Every 1 day', value: 86400000 },
  { label: 'Every 2 days', value: 172800000 },
  { label: 'Every 3 days', value: 259200000 },
  { label: 'Every 1 week', value: 604800000 },
  { label: 'Every 2 weeks', value: 1209600000 },
];

export function getValidOffsets(dueDateTimeMs, nowMs = Date.now()) {
  const maxOffset = dueDateTimeMs - nowMs;
  if (maxOffset <= 0) return [];
  return REMINDER_OFFSETS.filter((p) => p.value <= maxOffset);
}

export function getRecurringReminderOffsets(dueTime) {
  if (!dueTime) return [];
  const [h, m] = dueTime.split(':').map(Number);
  const minutesFromMidnight = h * 60 + m;
  const maxOffsetMs = minutesFromMidnight * 60 * 1000;
  if (maxOffsetMs <= 0) return [];
  return REMINDER_OFFSETS.filter((p) => p.value < maxOffsetMs);
}

export function getValidRepeats(reminderWindowMs) {
  if (reminderWindowMs <= 0) return [{ label: 'Once', value: 0 }];
  return REPEAT_INTERVALS.filter((p) => p.value === 0 || p.value < reminderWindowMs);
}

export function generateSchedulePreview(dueDateTimeMs, offsetMs, repeatMs = 0, limit = 10) {
  const schedule = [];
  const startMs = dueDateTimeMs - offsetMs;
  if (startMs >= dueDateTimeMs) return schedule;

  let currentMs = startMs;
  let count = 0;

  if (repeatMs === 0) {
    return [new Date(currentMs)];
  }

  while (currentMs < dueDateTimeMs && count < limit) {
    schedule.push(new Date(currentMs));
    currentMs += repeatMs;
    count++;
  }

  return schedule;
}

export function countTotalReminders(dueDateTimeMs, offsetMs, repeatMs = 0) {
  if (repeatMs === 0) return 1;
  const startMs = dueDateTimeMs - offsetMs;
  if (startMs >= dueDateTimeMs) return 0;
  const duration = dueDateTimeMs - startMs;
  return Math.ceil(duration / repeatMs);
}

export function formatEstimateDisplay(est) {
  if (!est || !est.trim()) return '';
  const s = est.trim().toLowerCase();

  let totalMinutes = 0;
  const colonMatch = s.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    totalMinutes = parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  } else {
    const hMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/);
    const mMatch = s.match(/(\d+)\s*(?:m|min|minute)/);

    if (hMatch || mMatch) {
      if (hMatch) totalMinutes += Math.round(parseFloat(hMatch[1]) * 60);
      if (mMatch) totalMinutes += parseInt(mMatch[1], 10);
    } else {
      const num = parseFloat(s);
      if (!isNaN(num)) {
        if (num <= 12) {
          totalMinutes = Math.round(num * 60);
        } else {
          totalMinutes = Math.round(num);
        }
      } else {
        return est.trim();
      }
    }
  }

  if (totalMinutes <= 0) return est.trim();
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDateIso(d) {
  const ny = d.getFullYear();
  const nm = pad2(d.getMonth() + 1);
  const nd = pad2(d.getDate());
  return `${ny}-${nm}-${nd}`;
}

export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

export function getInitialRecurringDueDate(frequency = 'daily', days, dueTime, baseDate = new Date()) {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);

  let isTimePassedToday = false;
  if (dueTime && dueTime.trim() !== '') {
    const [h, m] = dueTime.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const todayDeadline = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m, 0, 0);
      if (baseDate.getTime() >= todayDeadline.getTime()) {
        isTimePassedToday = true;
      }
    }
  }

  if (frequency === 'daily') {
    if (isTimePassedToday) {
      date.setDate(date.getDate() + 1);
    }
    return formatDateIso(date);
  }

  if (frequency === 'weekly') {
    if (days && days.length > 0) {
      const todayDay = date.getDay();
      if (days.includes(todayDay) && !isTimePassedToday) {
        return formatDateIso(date);
      }
      const d = new Date(date);
      for (let i = 1; i <= 7; i++) {
        d.setDate(d.getDate() + 1);
        if (days.includes(d.getDay())) {
          return formatDateIso(d);
        }
      }
    } else {
      if (isTimePassedToday) {
        date.setDate(date.getDate() + 7);
      }
      return formatDateIso(date);
    }
  }

  if (frequency === 'monthly') {
    if (days && days.length > 0) {
      const todayDate = date.getDate();
      if (days.includes(todayDate) && !isTimePassedToday) {
        return formatDateIso(date);
      }
      const d = new Date(date);
      for (let i = 1; i <= 366; i++) {
        d.setDate(d.getDate() + 1);
        if (days.includes(d.getDate())) {
          return formatDateIso(d);
        }
      }
    } else {
      if (isTimePassedToday) {
        date.setMonth(date.getMonth() + 1);
      }
      return formatDateIso(date);
    }
  }

  if (isTimePassedToday) {
    date.setDate(date.getDate() + 1);
  }

  return formatDateIso(date);
}

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatRecurrenceSchedule(frequency, days) {
  if (!frequency) return '';
  const freq = frequency.toLowerCase();

  if (freq === 'daily') {
    return 'Every day';
  }

  if (freq === 'weekly') {
    if (days && days.length > 0) {
      if (days.length === 7) return 'Every day';
      if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Every weekday (Mon - Fri)';
      if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Every weekend (Sat, Sun)';
      const sorted = [...days].sort((a, b) => a - b);
      return `Every ${sorted.map((d) => SHORT_DAY_NAMES[d]).join(', ')}`;
    }
    return 'Every week';
  }

  if (freq === 'monthly') {
    if (days && days.length > 0) {
      const sorted = [...days].sort((a, b) => a - b);
      return `Monthly on the ${sorted.map(getOrdinal).join(', ')}`;
    }
    return 'Every month';
  }

  if (freq.startsWith('custom_')) {
    const customDays = parseInt(freq.split('_')[1], 10) || 1;
    return `Every ${customDays} days`;
  }

  return `Repeats ${frequency}`;
}

export function advanceRecurringTaskDue(currentDue, frequency = 'daily', days) {
  const [y, m, d] = currentDue.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);

  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    if (days && days.length > 0) {
      for (let i = 1; i <= 7; i++) {
        date.setDate(date.getDate() + 1);
        if (days.includes(date.getDay())) {
          break;
        }
      }
    } else {
      date.setDate(date.getDate() + 7);
    }
  } else if (frequency === 'monthly') {
    if (days && days.length > 0) {
      for (let i = 1; i <= 366; i++) {
        date.setDate(date.getDate() + 1);
        if (days.includes(date.getDate())) {
          break;
        }
      }
    } else {
      date.setMonth(date.getMonth() + 1);
    }
  } else if (frequency.startsWith('custom_')) {
    const customDays = parseInt(frequency.split('_')[1], 10) || 1;
    date.setDate(date.getDate() + customDays);
  } else {
    date.setDate(date.getDate() + 1);
  }

  return formatDateIso(date);
}

export function formatRecurrenceDeadline(frequency, dueTime, days) {
  const timeStr = dueTime ? formatTime12h(dueTime) : 'End of day';
  const schedStr = formatRecurrenceSchedule(frequency, days);
  if (!schedStr) return timeStr;
  return `${schedStr} at ${timeStr}`;
}

export function getRecurringNextDeadlineDate(currentDue, dueTime, frequency, days) {
  let targetDueDate = currentDue;
  if (!targetDueDate) {
    targetDueDate = getInitialRecurringDueDate(frequency || 'daily', days, dueTime);
  }
  const [y, m, d] = targetDueDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);

  if (dueTime && dueTime.trim() !== '') {
    const [h, min] = dueTime.split(':').map(Number);
    if (!isNaN(h) && !isNaN(min)) {
      dt.setHours(h, min, 0, 0);
    }
  } else {
    dt.setHours(23, 59, 59, 999);
  }

  return dt;
}
