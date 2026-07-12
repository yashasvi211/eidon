import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoEidonAlarm.web.ts
// and on native platforms to ExpoEidonAlarm.ts
import ExpoEidonAlarmModule from './src/ExpoEidonAlarmModule';

export function scheduleAlarm(taskId: string, triggerTimeMs: number): void {
  return ExpoEidonAlarmModule.scheduleAlarm(taskId, triggerTimeMs);
}

export function cancelAlarm(taskId: string): void {
  return ExpoEidonAlarmModule.cancelAlarm(taskId);
}

export function stopAlarm(): void {
  return ExpoEidonAlarmModule.stopAlarm();
}

export function getEnqueuedAlarm(): string | null {
  return ExpoEidonAlarmModule.getEnqueuedAlarm();
}

// ── Permissions ──

export function canDrawOverlays(): boolean {
  return ExpoEidonAlarmModule.canDrawOverlays();
}

export function openOverlaySettings(): void {
  return ExpoEidonAlarmModule.openOverlaySettings();
}

export function canScheduleExactAlarms(): boolean {
  return ExpoEidonAlarmModule.canScheduleExactAlarms();
}

export function openExactAlarmSettings(): void {
  return ExpoEidonAlarmModule.openExactAlarmSettings();
}
