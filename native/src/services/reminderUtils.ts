export interface Preset {
  label: string;
  value: number; // offset in ms, or repeat interval in ms
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const REMINDER_OFFSETS: Preset[] = [
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

export const REPEAT_INTERVALS: Preset[] = [
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

export function getValidOffsets(dueDateTimeMs: number, nowMs: number = Date.now()): Preset[] {
  const maxOffset = dueDateTimeMs - nowMs;
  if (maxOffset <= 0) return [];
  return REMINDER_OFFSETS.filter(p => p.value <= maxOffset);
}

/**
 * For recurring tasks the due "date" is irrelevant — only the time-of-day matters.
 * Returns offsets that fit within the time available from midnight up to the given time.
 * e.g. dueTime "22:00" → 22 hours available → allows up to "12 Hours" offset, etc.
 */
export function getRecurringReminderOffsets(dueTime: string): Preset[] {
  const [h, m] = dueTime.split(':').map(Number);
  const minutesFromMidnight = h * 60 + m;
  const maxOffsetMs = minutesFromMidnight * 60 * 1000;
  if (maxOffsetMs <= 0) return [];
  return REMINDER_OFFSETS.filter(p => p.value < maxOffsetMs);
}

export function getValidRepeats(reminderWindowMs: number): Preset[] {
  if (reminderWindowMs <= 0) return [{ label: 'Once', value: 0 }];
  
  // Return 'Once' plus any interval that is strictly less than the window,
  // meaning it will trigger at least one additional time BEFORE the due time.
  const validRepeats = REPEAT_INTERVALS.filter(p => p.value === 0 || p.value < reminderWindowMs);
  return validRepeats;
}

export function generateSchedulePreview(dueDateTimeMs: number, offsetMs: number, repeatMs: number = 0, limit: number = 10): Date[] {
  const schedule: Date[] = [];
  const startMs = dueDateTimeMs - offsetMs;
  
  if (startMs >= dueDateTimeMs) return schedule; // Safety check

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

export function countTotalReminders(dueDateTimeMs: number, offsetMs: number, repeatMs: number = 0): number {
  if (repeatMs === 0) return 1;
  const startMs = dueDateTimeMs - offsetMs;
  if (startMs >= dueDateTimeMs) return 0;

  const duration = dueDateTimeMs - startMs;
  return Math.ceil(duration / repeatMs);
}

export function formatEstimateDisplay(est?: string): string {
  if (!est || !est.trim()) return "";
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateIso(d: Date): string {
  const ny = d.getFullYear();
  const nm = pad2(d.getMonth() + 1);
  const nd = pad2(d.getDate());
  return `${ny}-${nm}-${nd}`;
}

export function formatTime12h(time24?: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

/**
 * Calculates the initial due date (YYYY-MM-DD) for a recurring task.
 * If today matches the schedule and the deadline time hasn't passed, returns today's date.
 * If the deadline time has already passed today or today is not scheduled, returns the next closest scheduled date.
 */
export function getInitialRecurringDueDate(
  frequency: string = 'daily',
  days?: number[],
  dueTime?: string,
  baseDate: Date = new Date()
): string {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);

  // Check if today's time-of-day deadline has already passed
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

/**
 * Advances a recurring task's due date to its next scheduled occurrence.
 */
export function advanceRecurringTaskDue(currentDue: string, frequency: string = 'daily', days?: number[]): string {
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

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Returns a human-friendly description of recurrence schedule (e.g. "Every day", "Every Mon, Wed, Fri", "Monthly on the 1st, 15th")
 */
export function formatRecurrenceSchedule(frequency?: string, days?: number[]): string {
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
      return `Every ${sorted.map(d => SHORT_DAY_NAMES[d]).join(', ')}`;
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

/**
 * Returns formatted deadline description for recurring tasks (e.g., "Every day at 7:50 AM", "Every Mon, Wed at 7:50 AM")
 */
export function formatRecurrenceDeadline(frequency?: string, dueTime?: string, days?: number[]): string {
  const timeStr = dueTime ? formatTime12h(dueTime) : 'End of day';
  const schedStr = formatRecurrenceSchedule(frequency, days);
  if (!schedStr) return timeStr;
  return `${schedStr} at ${timeStr}`;
}

/**
 * Returns a Date object representing the next deadline for the recurring task.
 */
export function getRecurringNextDeadlineDate(currentDue?: string, dueTime?: string, frequency?: string, days?: number[]): Date {
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

