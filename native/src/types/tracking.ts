export type TrackerFrequency = 'daily' | 'weekly' | 'monthly';

export interface TrackerEntry {
  id: string;
  period: string;      // "2026-07-26" for daily, "2026-W30" for weekly, "2026-07" for monthly
  value: number;       // raw number. For time-based: seconds. For counts: the count. For decimal: the float.
  recordedAt: number;  // timestamp ms when this entry was recorded/edited
  note?: string;
}

export type TrackerValueType = 'count' | 'duration' | 'decimal';

export interface Tracker {
  id: string;
  name: string;
  emoji: string;
  unit: string;        // "books", "skips", "kg", "km", "hours" — used for display label
  valueType: TrackerValueType;
  frequency: TrackerFrequency;
  color: string;       // hex color for accent
  createdAt: number;
  entries: TrackerEntry[];
}
