import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Task, Session, AuditEntry } from "../components/DetailPanel";
import { Tracker, TrackerEntry } from "../types/tracking";
import { DROPBOX_APP_KEY, DROPBOX_APP_SECRET } from '../constants/env';

const DB_FILE_URI = FileSystem.documentDirectory + 'eidon_db.json';
const DROPBOX_API = 'https://api.dropboxapi.com';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com';

interface AppDatabase {
  tasks: Task[];
  projects: { name: string; color: string }[];
  trackers: Tracker[];
  settings: {
    isSleeping: boolean;
    sleepStartTime: number | null;
    dropboxToken: string;
    dropboxRefreshToken?: string;
    tokenExpiresAt?: number;
    dropboxPath: string;
    syncIntervalMinutes: number;
    lastSyncTime: number | null;
    autoSyncEnabled: boolean;
    reminderStyle: 'banner' | 'fullscreen';
    reminderRequireAuth: boolean;
  };
}

let memoryDb: AppDatabase = {
  tasks: [],
  projects: [],
  trackers: [],
  settings: {
    isSleeping: false,
    sleepStartTime: null,
    dropboxToken: '',
    dropboxRefreshToken: '',
    tokenExpiresAt: 0,
    dropboxPath: '/eidon_db.json',
    syncIntervalMinutes: 30,
    lastSyncTime: null,
    autoSyncEnabled: false,
    reminderStyle: 'banner',
    reminderRequireAuth: false,
  }
};

let dbLoaded = false;
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

async function loadDb() {
  if (dbLoaded) return;
  try {
    const fileInfo = await FileSystem.getInfoAsync(DB_FILE_URI);
    if (fileInfo.exists) {
      const content = await FileSystem.readAsStringAsync(DB_FILE_URI);
      const parsed = JSON.parse(content);
      memoryDb = { ...memoryDb, ...parsed };
      memoryDb.trackers = parsed.trackers || [];
      if (!memoryDb.settings) {
        memoryDb.settings = {
          isSleeping: false,
          sleepStartTime: null,
          dropboxToken: '',
          dropboxRefreshToken: '',
          tokenExpiresAt: 0,
          dropboxPath: '/eidon_db.json',
          syncIntervalMinutes: 30,
          lastSyncTime: null,
          autoSyncEnabled: false,
          reminderStyle: 'banner',
          reminderRequireAuth: false,
        };
      } else {
        memoryDb.settings = {
          isSleeping: memoryDb.settings.isSleeping ?? false,
          sleepStartTime: memoryDb.settings.sleepStartTime ?? null,
          dropboxToken: memoryDb.settings.dropboxToken ?? '',
          dropboxRefreshToken: memoryDb.settings.dropboxRefreshToken ?? '',
          tokenExpiresAt: memoryDb.settings.tokenExpiresAt ?? 0,
          dropboxPath: memoryDb.settings.dropboxPath ?? '/eidon_db.json',
          syncIntervalMinutes: memoryDb.settings.syncIntervalMinutes ?? 30,
          lastSyncTime: memoryDb.settings.lastSyncTime ?? null,
          autoSyncEnabled: memoryDb.settings.autoSyncEnabled ?? false,
          reminderStyle: memoryDb.settings.reminderStyle ?? 'banner',
          reminderRequireAuth: memoryDb.settings.reminderRequireAuth ?? false,
        };
      }
    }
  } catch (err) {
    console.error("Failed to load DB", err);
  }
  dbLoaded = true;
}

async function saveDb() {
  try {
    const content = JSON.stringify(memoryDb, null, 2);
    await FileSystem.writeAsStringAsync(DB_FILE_URI, content);
  } catch (err) {
    console.error("Failed to save DB", err);
  }
}

async function refreshAccessTokenIfNeeded() {
  if (!memoryDb.settings.dropboxRefreshToken) return;
  // Check if token expires within 5 minutes (300000ms)
  const expiresAt = memoryDb.settings.tokenExpiresAt || 0;
  if (Date.now() > expiresAt - 300000) {
    try {
      const response = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(memoryDb.settings.dropboxRefreshToken)}&client_id=${encodeURIComponent(DROPBOX_APP_KEY)}&client_secret=${encodeURIComponent(DROPBOX_APP_SECRET)}`,
      });
      if (response.ok) {
        const data = await response.json();
        memoryDb.settings.dropboxToken = data.access_token;
        memoryDb.settings.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        await saveDb();
      } else {
        const errText = await response.text();
        console.error('Failed to refresh token', errText);
        throw new Error('Could not refresh Dropbox token: ' + errText);
      }
    } catch (err) {
      console.error('Error refreshing token', err);
    }
  }
}

async function dropboxRequest(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    contentType?: string;
  } = {},
) {
  const token = memoryDb.settings.dropboxToken;
  if (!token) throw new Error("Dropbox not configured. Add an access token in Settings.");

  const { method = 'POST', headers = {}, body, contentType } = options;
  const url = endpoint.startsWith('https') ? endpoint : `${DROPBOX_API}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType || 'application/json',
      ...headers,
    },
    body: body !== undefined ? body : ((!contentType || contentType === 'application/json') && method === 'POST' ? 'null' : undefined),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Dropbox error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      const errField = errJson.error;
      const summary = errJson.error_summary
        || errJson.user_message
        || (typeof errField === 'string' ? errField : null)
        || errField?.['.tag']
        || '';
      if (summary) msg += `: ${summary}`;
    } catch {
      if (errorText) msg += `: ${errorText.slice(0, 300)}`;
    }
    throw new Error(msg);
  }

  return response;
}

async function mergeSeedData() {
  try {
    const bundledJson = require('../constants/tasks.json');
    if (!bundledJson) return;

    let changed = false;

    // Merge tasks — only add ones whose id doesn't exist yet
    if (bundledJson.tasks && Array.isArray(bundledJson.tasks)) {
      for (const seedTask of bundledJson.tasks) {
        const alreadyExists = memoryDb.tasks.some(t => t.id === seedTask.id);
        if (!alreadyExists) {
          memoryDb.tasks.push(JSON.parse(JSON.stringify(seedTask)));
          changed = true;
        }
      }
    }

    // Merge projects — only add ones whose name doesn't exist yet
    if (bundledJson.projects && Array.isArray(bundledJson.projects)) {
      for (const seedProj of bundledJson.projects) {
        const alreadyExists = memoryDb.projects.some(p => p.name === seedProj.name);
        if (!alreadyExists) {
          memoryDb.projects.push(seedProj);
          changed = true;
        }
      }
    }

    try {
      const trackingJson = require('../constants/tracking.json');
      const trackingList = Array.isArray(trackingJson) ? trackingJson : trackingJson.trackers;
      if (trackingList && Array.isArray(trackingList)) {
        for (const seedTracker of trackingList) {
          const idx = memoryDb.trackers.findIndex(t => t.id === seedTracker.id);
          if (idx === -1) {
            memoryDb.trackers.push(JSON.parse(JSON.stringify(seedTracker)));
            changed = true;
          } else if ((memoryDb.trackers[idx].entries?.length || 0) < (seedTracker.entries?.length || 0)) {
            memoryDb.trackers[idx] = JSON.parse(JSON.stringify(seedTracker));
            changed = true;
          }
        }
      }
    } catch (e) {
      console.log('No tracking seed data found');
    }


    if (changed) {
      await saveDb();
      console.log('Seed data merged from tasks.json');
    }
  } catch (err) {
    console.log('No seed data found, skipping merge');
  }
}

export const api = {
  async init() {
    await loadDb();
    // Always merge seed data — safe to call repeatedly, only adds missing entries
    await mergeSeedData();
    // Auto-clear legacy manually pasted tokens that don't have a refresh token
    if (memoryDb.settings.dropboxToken && !memoryDb.settings.dropboxRefreshToken) {
      memoryDb.settings.dropboxToken = '';
      memoryDb.settings.tokenExpiresAt = 0;
      await saveDb();
    }
  },


  // --- TRACKERS ---
  async getTrackers(): Promise<Tracker[]> {
    await loadDb();
    return memoryDb.trackers || [];
  },

  async createTracker(tracker: Tracker): Promise<void> {
    await loadDb();
    const exists = memoryDb.trackers.some(t => t.id === tracker.id);
    if (!exists) {
      memoryDb.trackers.push(JSON.parse(JSON.stringify(tracker)));
      await saveDb();
    }
  },

  async updateTracker(trackerId: string, updates: Partial<Tracker>): Promise<void> {
    await loadDb();
    const trackerIndex = memoryDb.trackers.findIndex(t => t.id === trackerId);
    if (trackerIndex !== -1) {
      memoryDb.trackers[trackerIndex] = { ...memoryDb.trackers[trackerIndex], ...updates };
      await saveDb();
    }
  },

  async deleteTracker(trackerId: string): Promise<void> {
    await loadDb();
    memoryDb.trackers = memoryDb.trackers.filter(t => t.id !== trackerId);
    await saveDb();
  },

  async upsertTrackerEntry(trackerId: string, entry: TrackerEntry): Promise<void> {
    await loadDb();
    const tracker = memoryDb.trackers.find(t => t.id === trackerId);
    if (tracker) {
      const entryIndex = tracker.entries.findIndex(e => e.period === entry.period);
      if (entryIndex !== -1) {
        tracker.entries[entryIndex] = entry;
      } else {
        tracker.entries.push(entry);
      }
      await saveDb();
    }
  },

  async deleteTrackerEntry(trackerId: string, entryId: string): Promise<void> {
    await loadDb();
    const tracker = memoryDb.trackers.find(t => t.id === trackerId);
    if (tracker) {
      tracker.entries = tracker.entries.filter(e => e.id !== entryId);
      await saveDb();
    }
  },

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    await loadDb();
    return memoryDb.tasks || [];
  },

  async createTask(task: Partial<Task>): Promise<void> {
    await loadDb();
    const exists = memoryDb.tasks.some(t => t.id === task.id);
    if (!exists) {
      memoryDb.tasks.push(JSON.parse(JSON.stringify(task)));
      await saveDb();
    }
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    await loadDb();
    const taskIndex = memoryDb.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      memoryDb.tasks[taskIndex] = { ...memoryDb.tasks[taskIndex], ...updates };
      await saveDb();
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    await loadDb();
    memoryDb.tasks = memoryDb.tasks.filter(t => t.id !== taskId);
    await saveDb();
  },

  // --- SUBTASKS ---
  async createSubtask(taskId: string, subtask: { id: string; title: string; done?: boolean }): Promise<void> {
    await loadDb();
    const task = memoryDb.tasks.find(t => t.id === taskId);
    if (task) {
      if (!task.subtasks) task.subtasks = [];
      task.subtasks.push({ id: subtask.id, title: subtask.title, done: subtask.done || false });
      await saveDb();
    }
  },

  async updateSubtask(taskId: string, subtaskId: string, updates: { title?: string; done?: boolean }): Promise<void> {
    await loadDb();
    const task = memoryDb.tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const sub = task.subtasks.find(s => s.id === subtaskId);
      if (sub) {
        if (updates.title !== undefined) sub.title = updates.title;
        if (updates.done !== undefined) sub.done = updates.done;
        await saveDb();
      }
    }
  },

  async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    await loadDb();
    const task = memoryDb.tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
      await saveDb();
    }
  },

  // --- SESSIONS ---
  async createSession(taskId: string, session: Session): Promise<void> {
    await loadDb();
    const task = memoryDb.tasks.find(t => t.id === taskId);
    if (task) {
      if (!task.sessions) task.sessions = [];
      task.sessions.push(session);
      await saveDb();
    }
  },

  // --- AUDIT LOGS ---
  async createAuditLog(taskId: string, entry: AuditEntry): Promise<void> {
    await loadDb();
    const task = memoryDb.tasks.find(t => t.id === taskId);
    if (task) {
      if (!task.auditLog) task.auditLog = [];
      task.auditLog.push(entry);
      await saveDb();
    }
  },

  // --- PROJECTS ---
  async getProjects(): Promise<{ name: string; color: string }[]> {
    await loadDb();
    return memoryDb.projects || [];
  },

  async createProject(project: { name: string; color: string }): Promise<void> {
    await loadDb();
    memoryDb.projects.push(project);
    await saveDb();
  },

  async deleteProject(projectName: string): Promise<void> {
    await loadDb();
    memoryDb.projects = memoryDb.projects.filter(p => p.name !== projectName);
    await saveDb();
  },

  // --- SETTINGS ---
  async getSettings() {
    await loadDb();
    return { ...memoryDb.settings };
  },

  async updateSettings(payload: Partial<AppDatabase['settings']>): Promise<void> {
    await loadDb();
    memoryDb.settings = { ...memoryDb.settings, ...payload };
    await saveDb();
  },

  // --- EXPORT / IMPORT JSON (works with any app, including Dropbox) ---
  async exportData() {
    await loadDb();
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(DB_FILE_URI, { mimeType: 'application/json', dialogTitle: 'Export Eidon Data' });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  },

  async importData() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      try {
        const parsed = JSON.parse(content);
        if (parsed.tasks) {
          memoryDb = { ...memoryDb, ...parsed };
      memoryDb.trackers = parsed.trackers || [];
          if (!memoryDb.settings) {
            memoryDb.settings = { isSleeping: false, sleepStartTime: null, dropboxToken: '', dropboxRefreshToken: '', tokenExpiresAt: 0, dropboxPath: '/eidon_db.json', syncIntervalMinutes: 30, lastSyncTime: null, autoSyncEnabled: false, reminderStyle: 'banner', reminderRequireAuth: false };
          }
          await saveDb();
          return true;
        } else {
          throw new Error("Invalid format");
        }
      } catch (e) {
        throw new Error("Invalid database file format.");
      }
    }
    return false;
  },

  // --- DROPBOX SYNC ---

  /**
   * Upload to Dropbox via API (requires access token).
   * Get a token at https://www.dropbox.com/developers/apps
   */
  async uploadToDropbox(): Promise<{ success: boolean; message: string }> {
    await loadDb();
    await refreshAccessTokenIfNeeded();
    const path = memoryDb.settings.dropboxPath || '/eidon_db.json';
    const token = memoryDb.settings.dropboxToken;
    if (!token) return { success: false, message: 'No Dropbox token configured.' };

    try {
      // Use Expo's native file uploader for proper binary content handling
      const result = await FileSystem.uploadAsync(
        `${DROPBOX_CONTENT}/2/files/upload`,
        DB_FILE_URI,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }),
            'Content-Type': 'application/octet-stream',
          },
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        },
      );

      if (result.status >= 200 && result.status < 300) {
        const now = Date.now();
        memoryDb.settings.lastSyncTime = now;
        await saveDb();
        return { success: true, message: 'Uploaded to Dropbox!' };
      } else {
        let msg = `Upload failed (${result.status})`;
        try {
          const errJson = JSON.parse(result.body);
          const errField = errJson.error;
          const summary = errJson.error_summary
            || (typeof errField === 'string' ? errField : null)
            || errField?.['.tag']
            || '';
          if (summary) msg += `: ${summary}`;
        } catch {
          if (result.body) msg += `: ${result.body.slice(0, 300)}`;
        }
        return { success: false, message: msg };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Upload failed' };
    }
  },

  /**
   * Test Dropbox API connection (requires access token).
   */
  async testDropboxConnection(): Promise<{ success: boolean; message: string }> {
    await loadDb();
    await refreshAccessTokenIfNeeded();
    const token = memoryDb.settings.dropboxToken;
    if (!token) return { success: false, message: 'No Dropbox token configured.' };

    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: 'null',
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Dropbox error (${response.status})`;
        try {
          const j = JSON.parse(text);
          const e = j.error;
          const s = j.error_summary || (typeof e === 'string' ? e : e?.['.tag']) || '';
          if (s) msg += `: ${s}`;
        } catch {
          if (text) msg += `: ${text.slice(0, 300)}`;
        }
        return { success: false, message: msg };
      }

      const account = await response.json();
      return { success: true, message: `Connected as ${account.email || account.name?.display_name || 'unknown'}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection test failed' };
    }
  },

  // --- AUTO SYNC (requires access token for upload) ---
  startAutoSync(callback?: (result: { success: boolean; message: string }) => void) {
    this.stopAutoSync();
    if (!memoryDb.settings.autoSyncEnabled || !memoryDb.settings.dropboxToken) return;
    const intervalMs = memoryDb.settings.syncIntervalMinutes * 60 * 1000;
    autoSyncTimer = setInterval(async () => {
      const result = await this.uploadToDropbox();
      if (callback) callback(result);
    }, intervalMs);
  },

  stopAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  },

  isAutoSyncRunning(): boolean {
    return autoSyncTimer !== null;
  },

  // --- GET RAW JSON STRING (for debug / display) ---
  async getRawJson(): Promise<string> {
    await loadDb();
    return JSON.stringify(memoryDb, null, 2);
  },
};
