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
