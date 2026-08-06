import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Task, Session, AuditEntry } from '../components/DetailPanel';
import { Tracker, TrackerEntry } from '../types/tracking';
import { DROPBOX_APP_KEY, DROPBOX_APP_SECRET } from '../constants/env';

// ─── File System Layout ──────────────────────────────────────────────────────
//
//  <documentDirectory>/eidon/
//  ├── settings.json
//  ├── Inbox/
//  │   └── <task-id>.json
//  ├── <ProjectName>/
//  │   └── <task-id>.json
//  └── tracking/
//      └── <tracker-id>.json
//
// ─────────────────────────────────────────────────────────────────────────────

const EIDON_DIR      = FileSystem.documentDirectory + 'eidon/';
const SETTINGS_FILE  = EIDON_DIR + 'settings.json';
const TRACKING_DIR   = EIDON_DIR + 'tracking/';
const LEGACY_DB_FILE = FileSystem.documentDirectory + 'eidon_db.json';
const DROPBOX_API    = 'https://api.dropboxapi.com';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com';

// ─── Settings type ────────────────────────────────────────────────────────────

export interface AppSettings {
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
}

const DEFAULT_SETTINGS: AppSettings = {
  isSleeping: false,
  sleepStartTime: null,
  dropboxToken: '',
  dropboxRefreshToken: '',
  tokenExpiresAt: 0,
  dropboxPath: '/eidon/',
  syncIntervalMinutes: 30,
  lastSyncTime: null,
  autoSyncEnabled: false,
  reminderStyle: 'banner',
  reminderRequireAuth: false,
};

// ─── In-memory cache (populated on first access, updated on writes) ───────────

interface MemoryCache {
  tasks: Task[];
  projects: string[];  // just folder names; colour stored in a meta sidecar
  projectMeta: { name: string; color: string }[];  // full project objects
  trackers: Tracker[];
  settings: AppSettings;
  loaded: boolean;
}

let cache: MemoryCache = {
  tasks: [],
  projects: [],
  projectMeta: [],
  trackers: [],
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
};

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

// ─── Low-level helpers ────────────────────────────────────────────────────────

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function writeJson(uri: string, data: unknown) {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readJson<T>(uri: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// Returns folder names inside a dir, filtering hidden/system files
async function listFolders(dir: string): Promise<string[]> {
  try {
    const items = await FileSystem.readDirectoryAsync(dir);
    const result: string[] = [];
    for (const item of items) {
      if (item.startsWith('.') || item === 'tracking') continue;
      const info = await FileSystem.getInfoAsync(dir + item);
      if (info.isDirectory) result.push(item);
    }
    return result;
  } catch {
    return [];
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const items = await FileSystem.readDirectoryAsync(dir);
    return items.filter(f => f.endsWith('.json') && !f.startsWith('.'));
  } catch {
    return [];
  }
}

// project name → safe folder name (replace slashes etc)
function projectFolder(project: string): string {
  return project.trim().replace(/[/\\:*?"<>|]/g, '_') || 'Inbox';
}

function taskFilePath(project: string, taskId: string): string {
  return EIDON_DIR + projectFolder(project) + '/' + taskId + '.json';
}

function trackerFilePath(trackerId: string): string {
  return TRACKING_DIR + trackerId + '.json';
}

// ─── projects meta sidecar ──────────────────────────────────────────────────
// We store project color info in <projectFolder>/.meta.json

async function readProjectMeta(folderName: string): Promise<{ name: string; color: string }> {
  const meta = await readJson<{ name: string; color: string }>(
    EIDON_DIR + folderName + '/.meta.json'
  );
  const name = (meta && meta.name && typeof meta.name === 'string' && meta.name.trim() !== '') 
    ? meta.name 
    : folderName;
  const color = (meta && meta.color && typeof meta.color === 'string' && meta.color.trim() !== '') 
    ? meta.color 
    : '#58a6ff';
  return { name, color };
}

async function writeProjectMeta(folderName: string, data: { name: string; color: string }) {
  await writeJson(EIDON_DIR + folderName + '/.meta.json', data);
}

// ─── Migration from legacy single-file DB ────────────────────────────────────

async function migrateLegacyDb() {
  const info = await FileSystem.getInfoAsync(LEGACY_DB_FILE);
  if (!info.exists) return;

  console.log('[eidon] Migrating legacy eidon_db.json to folder structure…');
  try {
    const content = await FileSystem.readAsStringAsync(LEGACY_DB_FILE);
    const legacy = JSON.parse(content);

    // Migrate settings
    if (legacy.settings) {
      const s: AppSettings = { ...DEFAULT_SETTINGS, ...legacy.settings };
      // wipe manually-pasted tokens that have no refresh token
      if (s.dropboxToken && !s.dropboxRefreshToken) {
        s.dropboxToken = '';
        s.tokenExpiresAt = 0;
      }
      s.dropboxPath = s.dropboxPath?.replace('eidon_db.json', '') || '/eidon/';
      await writeJson(SETTINGS_FILE, s);
    }

    // Migrate projects (with colours)
    const projectList: { name: string; color: string }[] = legacy.projects || [];
    // Always ensure Inbox exists
    if (!projectList.some(p => p.name === 'Inbox')) {
      projectList.unshift({ name: 'Inbox', color: '#58a6ff' });
    }
    for (const proj of projectList) {
      const folder = projectFolder(proj.name);
      await ensureDir(EIDON_DIR + folder + '/');
      await writeProjectMeta(folder, proj);
    }

    // Migrate tasks
    const tasks: Task[] = legacy.tasks || [];
    for (const task of tasks) {
      const proj = task.project || 'Inbox';
      const folder = projectFolder(proj);
      await ensureDir(EIDON_DIR + folder + '/');
      await writeJson(taskFilePath(proj, task.id), task);
    }

    // Migrate trackers
    await ensureDir(TRACKING_DIR);
    const trackers: Tracker[] = legacy.trackers || [];
    for (const tracker of trackers) {
      await writeJson(trackerFilePath(tracker.id), tracker);
    }

    // Rename legacy file so migration doesn't run again
    await FileSystem.moveAsync({
      from: LEGACY_DB_FILE,
      to: LEGACY_DB_FILE + '.migrated',
    });

    console.log('[eidon] Migration complete.');
  } catch (err) {
    console.error('[eidon] Migration failed:', err);
  }
}

// ─── Load everything into memory cache ───────────────────────────────────────

async function loadAll() {
  if (cache.loaded) return;

  await ensureDir(EIDON_DIR);
  await ensureDir(TRACKING_DIR);
  // Always ensure Inbox project exists
  await ensureDir(EIDON_DIR + 'Inbox/');

  // Run migration if old file exists
  await migrateLegacyDb();

  // Settings
  const settings = await readJson<AppSettings>(SETTINGS_FILE);
  cache.settings = settings ? { ...DEFAULT_SETTINGS, ...settings } : { ...DEFAULT_SETTINGS };

  // Projects (scan folders)
  const folderNames = await listFolders(EIDON_DIR);
  // Always include Inbox even if empty
  if (!folderNames.includes('Inbox')) folderNames.unshift('Inbox');
  cache.projectMeta = [];
  cache.tasks = [];

  const seenProjNames = new Set<string>();
  const seenTaskIds = new Set<string>();
  for (const folder of folderNames) {
    const meta = await readProjectMeta(folder);
    const lower = meta.name.toLowerCase();
    if (!seenProjNames.has(lower)) {
      seenProjNames.add(lower);
      cache.projectMeta.push(meta);
    }

    // Load tasks inside this folder
    const files = await listJsonFiles(EIDON_DIR + folder + '/');
    for (const file of files) {
      const task = await readJson<Task>(EIDON_DIR + folder + '/' + file);
      if (task) {
        // Self-healing: backfill missing sessions from auditLog entries if needed
        if (task.auditLog && task.auditLog.length > 0) {
          if (!task.sessions) task.sessions = [];
          let backfilled = false;

          for (const entry of task.auditLog) {
            if (entry.action === 'time_logged' || entry.action === 'timer_stopped') {
              const durationSec = entry.details?.duration;
              if (durationSec && durationSec > 0) {
                const endMs = entry.timestamp;
                const startMs = endMs - (durationSec * 1000);

                const exists = task.sessions.some(s =>
                  Math.abs(s.end - endMs) < 5000 || Math.abs(s.start - startMs) < 5000
                );

                if (!exists) {
                  const newSess: Session = {
                    id: `sess_audit_${entry.timestamp}`,
                    start: startMs,
                    end: endMs,
                    note: entry.details?.note,
                  };
                  task.sessions.push(newSess);
                  backfilled = true;
                }
              }
            }
          }

          if (backfilled) {
            task.sessions.sort((a, b) => b.start - a.start);
            await writeJson(EIDON_DIR + folder + '/' + file, task);
          }
        }

        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id);
          cache.tasks.push(task);
        } else {
          // Duplicate task file on disk! Delete it so it never reappears.
          try {
            await FileSystem.deleteAsync(EIDON_DIR + folder + '/' + file, { idempotent: true });
          } catch (e) {}
        }
      }
    }
  }

  // Trackers
  cache.trackers = [];
  const trackerFiles = await listJsonFiles(TRACKING_DIR);
  for (const file of trackerFiles) {
    const tracker = await readJson<Tracker>(TRACKING_DIR + file);
    if (tracker) cache.trackers.push(tracker);
  }

  cache.loaded = true;
}

// ─── Dropbox helpers ──────────────────────────────────────────────────────────

async function refreshAccessTokenIfNeeded() {
  if (!cache.settings.dropboxRefreshToken) return;
  const expiresAt = cache.settings.tokenExpiresAt || 0;
  if (Date.now() > expiresAt - 300000) {
    try {
      const response = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(cache.settings.dropboxRefreshToken!)}&client_id=${encodeURIComponent(DROPBOX_APP_KEY)}&client_secret=${encodeURIComponent(DROPBOX_APP_SECRET)}`,
      });
      if (response.ok) {
        const data = await response.json();
        cache.settings.dropboxToken = data.access_token;
        cache.settings.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        await writeJson(SETTINGS_FILE, cache.settings);
      } else {
        const errText = await response.text();
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
  const token = cache.settings.dropboxToken;
  if (!token) throw new Error('Dropbox not configured. Add an access token in Settings.');

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

// Build a single export JSON from current state (for Dropbox backup)
function buildExportJson(): string {
  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: cache.settings,
    projects: cache.projectMeta,
    tasks: cache.tasks,
    trackers: cache.trackers,
  }, null, 2);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {

  async init() {
    await loadAll();
  },

  // ── PROJECTS ────────────────────────────────────────────────────────────────

  async getProjects(): Promise<{ name: string; color: string }[]> {
    await loadAll();
    const seen = new Set<string>();
    const uniq: { name: string; color: string }[] = [];
    for (const p of cache.projectMeta) {
      const lower = p.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniq.push(p);
      }
    }
    cache.projectMeta = uniq;
    return [...cache.projectMeta];
  },

  async createProject(project: { name: string; color: string }): Promise<void> {
    await loadAll();
    const already = cache.projectMeta.some(p => p.name.toLowerCase() === project.name.toLowerCase());
    if (already) return;
    const folder = projectFolder(project.name);
    await ensureDir(EIDON_DIR + folder + '/');
    await writeProjectMeta(folder, project);
    cache.projectMeta.push(project);
  },

  async deleteProject(projectName: string): Promise<void> {
    await loadAll();
    const folder = projectFolder(projectName);
    const dirInfo = await FileSystem.getInfoAsync(EIDON_DIR + folder + '/');
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(EIDON_DIR + folder + '/', { idempotent: true });
    }
    cache.projectMeta = cache.projectMeta.filter(p => p.name.toLowerCase() !== projectName.toLowerCase());
    cache.tasks = cache.tasks.filter(t => t.project !== projectName);
  },

  // ── TASKS ────────────────────────────────────────────────────────────────────

  async getTasks(): Promise<Task[]> {
    await loadAll();
    const seen = new Set<string>();
    const uniq: Task[] = [];
    for (const t of cache.tasks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        uniq.push(t);
      }
    }
    cache.tasks = uniq;
    return [...cache.tasks];
  },

  async createTask(task: Partial<Task>): Promise<void> {
    await loadAll();
    if (!task.id) return;
    const already = cache.tasks.some(t => t.id === task.id);
    if (already) return;
    const proj = (task as Task).project || 'Inbox';
    const folder = projectFolder(proj);
    await ensureDir(EIDON_DIR + folder + '/');
    const full = task as Task;
    await writeJson(taskFilePath(proj, full.id), full);
    cache.tasks.push(full);
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    await loadAll();
    const idx = cache.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) {
      if (updates.id && updates.title) {
        await api.createTask(updates as Task);
      }
      return;
    }
    const oldTask = cache.tasks[idx];
    const updated = { ...oldTask, ...updates };
    cache.tasks[idx] = updated;
    // If project changed, move the file
    if (updates.project && updates.project !== oldTask.project) {
      const oldPath = taskFilePath(oldTask.project || 'Inbox', taskId);
      const newFolder = projectFolder(updates.project);
      await ensureDir(EIDON_DIR + newFolder + '/');
      await FileSystem.deleteAsync(oldPath, { idempotent: true }).catch(() => {});
      await writeJson(taskFilePath(updates.project, taskId), updated);
    } else {
      await writeJson(taskFilePath(updated.project || 'Inbox', taskId), updated);
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    await loadAll();
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Move to .trash folder
    const proj = task.project || 'Inbox';
    const folder = projectFolder(proj);
    const trashDir = EIDON_DIR + folder + '/.trash/';
    await ensureDir(trashDir);
    await writeJson(trashDir + taskId + '.json', task);

    for (const projMeta of cache.projectMeta) {
      const path = taskFilePath(projMeta.name, taskId);
      await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    }
    await FileSystem.deleteAsync(taskFilePath('Inbox', taskId), { idempotent: true }).catch(() => {});
    cache.tasks = cache.tasks.filter(t => t.id !== taskId);
  },

  // ── SUBTASKS ─────────────────────────────────────────────────────────────────

  async createSubtask(taskId: string, subtask: { id: string; title: string; done?: boolean; description?: string }): Promise<void> {
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ id: subtask.id, title: subtask.title, done: subtask.done || false, description: subtask.description });
    await writeJson(taskFilePath(task.project || 'Inbox', taskId), task);
  },

  async updateSubtask(taskId: string, subtaskId: string, updates: { title?: string; done?: boolean; description?: string }): Promise<void> {
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task?.subtasks) return;
    const sub = task.subtasks.find(s => s.id === subtaskId);
    if (!sub) return;
    if (updates.title !== undefined) sub.title = updates.title;
    if (updates.done !== undefined) sub.done = updates.done;
    if (updates.description !== undefined) sub.description = updates.description;
    await writeJson(taskFilePath(task.project || 'Inbox', taskId), task);
  },

  async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task?.subtasks) return;
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
    await writeJson(taskFilePath(task.project || 'Inbox', taskId), task);
  },

  // ── SESSIONS ─────────────────────────────────────────────────────────────────

  async createSession(taskId: string, session: Session): Promise<void> {
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.sessions) task.sessions = [];
    task.sessions.push(session);
    await writeJson(taskFilePath(task.project || 'Inbox', taskId), task);
  },

  // ── AUDIT LOGS ───────────────────────────────────────────────────────────────

  async createAuditLog(taskId: string, entry: AuditEntry): Promise<void> {
    const task = cache.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.auditLog) task.auditLog = [];
    task.auditLog.push(entry);
    await writeJson(taskFilePath(task.project || 'Inbox', taskId), task);
  },

  // ── TRACKERS ─────────────────────────────────────────────────────────────────

  async getTrackers(): Promise<Tracker[]> {
    await loadAll();
    return [...cache.trackers];
  },

  async createTracker(tracker: Tracker): Promise<void> {
    await loadAll();
    const already = cache.trackers.some(t => t.id === tracker.id);
    if (already) return;
    await ensureDir(TRACKING_DIR);
    await writeJson(trackerFilePath(tracker.id), tracker);
    cache.trackers.push(tracker);
  },

  async updateTracker(trackerId: string, updates: Partial<Tracker>): Promise<void> {
    await loadAll();
    const idx = cache.trackers.findIndex(t => t.id === trackerId);
    if (idx === -1) return;
    const updated = { ...cache.trackers[idx], ...updates };
    cache.trackers[idx] = updated;
    await writeJson(trackerFilePath(trackerId), updated);
  },

  async deleteTracker(trackerId: string): Promise<void> {
    await loadAll();
    await FileSystem.deleteAsync(trackerFilePath(trackerId), { idempotent: true });
    cache.trackers = cache.trackers.filter(t => t.id !== trackerId);
  },

  async upsertTrackerEntry(trackerId: string, entry: TrackerEntry): Promise<void> {
    await loadAll();
    const tracker = cache.trackers.find(t => t.id === trackerId);
    if (!tracker) return;
    const idx = tracker.entries.findIndex(e => e.period === entry.period);
    if (idx !== -1) {
      tracker.entries[idx] = entry;
    } else {
      tracker.entries.push(entry);
    }
    await writeJson(trackerFilePath(trackerId), tracker);
  },

  async deleteTrackerEntry(trackerId: string, entryId: string): Promise<void> {
    await loadAll();
    const tracker = cache.trackers.find(t => t.id === trackerId);
    if (!tracker) return;
    tracker.entries = tracker.entries.filter(e => e.id !== entryId);
    await writeJson(trackerFilePath(trackerId), tracker);
  },

  // ── SETTINGS ─────────────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    await loadAll();
    return { ...cache.settings };
  },

  async updateSettings(payload: Partial<AppSettings>): Promise<void> {
    await loadAll();
    cache.settings = { ...cache.settings, ...payload };
    await writeJson(SETTINGS_FILE, cache.settings);
  },

  // ── MOCK DATA ────────────────────────────────────────────────────────────────

  async loadMockData(): Promise<{ tasks: number; trackers: number }> {
    await loadAll();
    let taskCount = 0;
    let trackerCount = 0;

    // Load tasks mock data
    try {
      const tasksJson = require('../constants/tasks.json');
      if (tasksJson.projects) {
        for (const proj of tasksJson.projects as { name: string; color: string }[]) {
          const exists = cache.projectMeta.some(p => p.name === proj.name);
          if (!exists) {
            await api.createProject(proj);
          }
        }
      }
      if (tasksJson.tasks) {
        for (const task of tasksJson.tasks as Task[]) {
          const exists = cache.tasks.some(t => t.id === task.id);
          if (!exists) {
            await api.createTask(task);
            taskCount++;
          }
        }
      }
    } catch (e) {
      console.log('[mock] No tasks.json found');
    }

    // Load tracking mock data
    try {
      const trackingJson = require('../constants/tracking.json');
      const trackerList = Array.isArray(trackingJson) ? trackingJson : trackingJson.trackers;
      if (trackerList) {
        for (const tracker of trackerList as Tracker[]) {
          const existingIdx = cache.trackers.findIndex(t => t.id === tracker.id);
          if (existingIdx === -1) {
            await api.createTracker(tracker);
            trackerCount++;
          } else if ((cache.trackers[existingIdx].entries?.length || 0) < (tracker.entries?.length || 0)) {
            // Upgrade sparse existing tracker with richer mock data
            cache.trackers[existingIdx] = tracker;
            await writeJson(trackerFilePath(tracker.id), tracker);
            trackerCount++;
          }
        }
      }
    } catch (e) {
      console.log('[mock] No tracking.json found');
    }

    return { tasks: taskCount, trackers: trackerCount };
  },

  async removeMockData(): Promise<{ tasks: number; trackers: number }> {
    await loadAll();
    let taskCount = 0;
    let trackerCount = 0;

    try {
      const tasksJson = require('../constants/tasks.json');
      if (tasksJson.tasks) {
        for (const mockTask of tasksJson.tasks as Task[]) {
          const matching = cache.tasks.filter(t => t.id === mockTask.id || t.title === mockTask.title);
          for (const m of matching) {
            await api.deleteTask(m.id);
            taskCount++;
          }
        }
      }
      if (tasksJson.projects) {
        for (const proj of tasksJson.projects as { name: string; color: string }[]) {
          if (proj.name !== 'Inbox' && !cache.tasks.some(t => t.project === proj.name)) {
            await api.deleteProject(proj.name);
          }
        }
      }
    } catch (e) {}

    try {
      const trackingJson = require('../constants/tracking.json');
      const trackerList = Array.isArray(trackingJson) ? trackingJson : trackingJson.trackers;
      if (trackerList) {
        for (const mockTracker of trackerList as Tracker[]) {
          const matching = cache.trackers.filter(t => t.id === mockTracker.id || t.name === mockTracker.name);
          for (const m of matching) {
            await api.deleteTracker(m.id);
            trackerCount++;
          }
        }
      }
    } catch (e) {}

    return { tasks: taskCount, trackers: trackerCount };
  },

  // ── EXPORT / IMPORT ──────────────────────────────────────────────────────────

  async exportData() {
    await loadAll();
    // Write export to a temp file and share it
    const exportUri = FileSystem.documentDirectory + 'eidon_export.json';
    await FileSystem.writeAsStringAsync(exportUri, buildExportJson());
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exportUri, { mimeType: 'application/json', dialogTitle: 'Export Eidon Data' });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  },

  async importData(): Promise<boolean> {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      try {
        const parsed = JSON.parse(content);
        // Support both v1 (legacy single-file) and v2 (new export format)
        const tasks: Task[] = parsed.tasks || [];
        const projects: { name: string; color: string }[] = parsed.projects || [];
        const trackers: Tracker[] = parsed.trackers || [];
        const settings: Partial<AppSettings> = parsed.settings || {};

        if (tasks.length === 0 && trackers.length === 0) {
          throw new Error('No tasks or trackers found in the file.');
        }

        // Reset cache so we rewrite everything
        cache.loaded = false;
        await loadAll();

        // Write settings (merge, don't overwrite tokens)
        const { dropboxToken, dropboxRefreshToken, tokenExpiresAt, ...safeSettings } = settings;
        await api.updateSettings(safeSettings);

        // Write projects
        for (const proj of projects) {
          await api.createProject(proj);
        }

        // Write tasks
        for (const task of tasks) {
          const exists = cache.tasks.some(t => t.id === task.id);
          if (!exists) await api.createTask(task);
        }

        // Write trackers
        for (const tracker of trackers) {
          const exists = cache.trackers.some(t => t.id === tracker.id);
          if (!exists) await api.createTracker(tracker);
        }

        return true;
      } catch (e: any) {
        throw new Error('Invalid Eidon export file: ' + e.message);
      }
    }
    return false;
  },

  // ── DROPBOX SYNC ─────────────────────────────────────────────────────────────

  async uploadToDropbox(): Promise<{ success: boolean; message: string }> {
    await loadAll();
    await refreshAccessTokenIfNeeded();
    const token = cache.settings.dropboxToken;
    if (!token) return { success: false, message: 'No Dropbox token configured.' };

    let remoteRoot = cache.settings.dropboxPath || '/eidon';
    if (remoteRoot.endsWith('.json')) {
      remoteRoot = remoteRoot.substring(0, remoteRoot.lastIndexOf('/')) || '/eidon';
    }
    if (remoteRoot.endsWith('/')) remoteRoot = remoteRoot.slice(0, -1);

    try {
      const filesToUpload: { localPath: string; relPath: string }[] = [];
      const scanDirForUpload = async (dir: string, prefix: string) => {
        try {
          const items = await FileSystem.readDirectoryAsync(dir);
          for (const item of items) {
            if (item.startsWith('.') && item !== '.meta.json') continue;
            const fullPath = dir + item;
            const info = await FileSystem.getInfoAsync(fullPath);
            if (info.isDirectory) {
              await scanDirForUpload(fullPath + '/', prefix + '/' + item);
            } else if (item.endsWith('.json')) {
              filesToUpload.push({ localPath: fullPath, relPath: prefix + '/' + item });
            }
          }
        } catch {}
      };

      await scanDirForUpload(EIDON_DIR, '');
      if (filesToUpload.length === 0) {
        return { success: false, message: 'No files found to sync.' };
      }

      let uploadedCount = 0;
      let lastError = '';

      for (const f of filesToUpload) {
        try {
          const content = await FileSystem.readAsStringAsync(f.localPath);
          const remoteFilePath = `${remoteRoot}${f.relPath}`;
          const response = await fetch(`${DROPBOX_CONTENT}/2/files/upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Dropbox-API-Arg': JSON.stringify({ path: remoteFilePath, mode: 'overwrite', mute: true }),
              'Content-Type': 'application/octet-stream',
            },
            body: content,
          });
          if (response.status >= 200 && response.status < 300) {
            uploadedCount++;
          } else {
            lastError = `Failed on ${f.relPath} (${response.status})`;
          }
        } catch (e: any) {
          lastError = e.message || 'Network error';
        }
      }

      if (uploadedCount > 0) {
        cache.settings.lastSyncTime = Date.now();
        await writeJson(SETTINGS_FILE, cache.settings);
        return { success: true, message: `Synced ${uploadedCount} files across folders to Dropbox (${remoteRoot})` };
      } else {
        return { success: false, message: `Upload failed: ${lastError || 'Unknown error'}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Upload failed' };
    }
  },

  async syncFromDropbox(): Promise<{ success: boolean; message: string }> {
    await loadAll();
    await refreshAccessTokenIfNeeded();
    const token = cache.settings.dropboxToken;
    if (!token) return { success: false, message: 'No Dropbox token configured.' };

    let remoteRoot = cache.settings.dropboxPath || '/eidon';
    if (remoteRoot.endsWith('.json')) {
      remoteRoot = remoteRoot.substring(0, remoteRoot.lastIndexOf('/')) || '/eidon';
    }
    if (remoteRoot.endsWith('/')) remoteRoot = remoteRoot.slice(0, -1);

    try {
      const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: remoteRoot === '' ? '' : remoteRoot, recursive: true }),
      });

      if (!listResponse.ok) {
        const errText = await listResponse.text();
        return { success: false, message: `Dropbox list failed (${listResponse.status})` };
      }

      let listData = await listResponse.json();
      let entries: any[] = listData.entries || [];

      while (listData.has_more && listData.cursor) {
        const contResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cursor: listData.cursor }),
        });
        if (contResponse.ok) {
          listData = await contResponse.json();
          entries = entries.concat(listData.entries || []);
        } else {
          break;
        }
      }

      const jsonFiles = entries.filter((e: any) => e['.tag'] === 'file' && e.path_display && e.path_display.endsWith('.json'));
      if (jsonFiles.length === 0) {
        return { success: false, message: 'No JSON files found in Dropbox to sync.' };
      }

      let downloadedCount = 0;
      let lastError = '';

      for (const entry of jsonFiles) {
        try {
          const downloadResp = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Dropbox-API-Arg': JSON.stringify({ path: entry.path_display }),
            },
          });

          if (downloadResp.ok) {
            const content = await downloadResp.text();
            let relPath = entry.path_display;
            if (remoteRoot && relPath.toLowerCase().startsWith(remoteRoot.toLowerCase())) {
              relPath = relPath.substring(remoteRoot.length);
            }
            if (!relPath.startsWith('/')) relPath = '/' + relPath;

            const localPath = `${EIDON_DIR}${relPath}`;
            const lastSlash = localPath.lastIndexOf('/');
            if (lastSlash > 0) {
              const dirPath = localPath.substring(0, lastSlash);
              try {
                await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
              } catch {}
            }
            await FileSystem.writeAsStringAsync(localPath, content);
            downloadedCount++;
          } else {
            lastError = `Failed downloading ${entry.name} (${downloadResp.status})`;
          }
        } catch (e: any) {
          lastError = e.message || 'Download error';
        }
      }

      if (downloadedCount > 0) {
        cache.settings.lastSyncTime = Date.now();
        await writeJson(SETTINGS_FILE, cache.settings);
        cache.loaded = false;
        await loadAll();
        return { success: true, message: `Synced ${downloadedCount} files from Dropbox to app storage` };
      } else {
        return { success: false, message: `Sync failed: ${lastError || 'No files downloaded'}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Sync from Dropbox failed' };
    }
  },

  async testDropboxConnection(): Promise<{ success: boolean; message: string }> {
    await loadAll();
    await refreshAccessTokenIfNeeded();
    const token = cache.settings.dropboxToken;
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
          const s = j.error_summary || (typeof j.error === 'string' ? j.error : j.error?.['.tag']) || '';
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

  // ── AUTO SYNC ────────────────────────────────────────────────────────────────

  startAutoSync(callback?: (result: { success: boolean; message: string }) => void) {
    this.stopAutoSync();
    if (!cache.settings.autoSyncEnabled || !cache.settings.dropboxToken) return;
    const intervalMs = cache.settings.syncIntervalMinutes * 60 * 1000;
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

  // ── DEBUG ────────────────────────────────────────────────────────────────────

  async getRawJson(): Promise<string> {
    await loadAll();
    return buildExportJson();
  },

  /** Returns the on-device eidon folder URI for display purposes */
  getStorageRoot(): string {
    return EIDON_DIR;
  },

  /** List all files in the eidon folder tree (for debugging / Dropbox preview) */
  async listAllFiles(): Promise<{ path: string; size?: number }[]> {
    await loadAll();
    const result: { path: string; size?: number }[] = [];

    const scanDir = async (dir: string, prefix: string) => {
      try {
        const items = await FileSystem.readDirectoryAsync(dir);
        for (const item of items) {
          const fullPath = dir + item;
          const info = await FileSystem.getInfoAsync(fullPath);
          if (info.isDirectory) {
            result.push({ path: prefix + item + '/' });
            await scanDir(fullPath + '/', prefix + item + '/');
          } else {
            result.push({ path: prefix + item, size: (info as any).size });
          }
        }
      } catch { /* skip inaccessible dirs */ }
    };

    await scanDir(EIDON_DIR, 'eidon/');
    return result;
  },
};
