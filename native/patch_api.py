import re

with open('src/services/api.ts', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { Task, Session, AuditEntry } from \"../components/DetailPanel\";\nimport { Tracker, TrackerEntry } from \"../types/tracking\";\n"
content = re.sub(r'import { Task, Session, AuditEntry } from "../components/DetailPanel";\n', import_stmt, content)

# Add to AppDatabase
db_iface = "interface AppDatabase {\n  tasks: Task[];\n  projects: { name: string; color: string }[];\n  trackers: Tracker[];\n"
content = re.sub(r'interface AppDatabase \{\n  tasks: Task\[\];\n  projects: \{ name: string; color: string \}\[\];\n', db_iface, content)

# Add to memoryDb
mem_db = "let memoryDb: AppDatabase = {\n  tasks: [],\n  projects: [],\n  trackers: [],\n"
content = re.sub(r'let memoryDb: AppDatabase = \{\n  tasks: \[\],\n  projects: \[\],\n', mem_db, content)

# Update loadDb
load_db = "memoryDb = { ...memoryDb, ...parsed };\n      memoryDb.trackers = parsed.trackers || [];"
content = re.sub(r'memoryDb = { \.\.\.memoryDb, \.\.\.parsed };', load_db, content)

# Update mergeSeedData
merge_seed = """    // Merge projects — only add ones whose name doesn't exist yet
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
      if (trackingJson && Array.isArray(trackingJson)) {
        for (const seedTracker of trackingJson) {
          const alreadyExists = memoryDb.trackers.some(t => t.id === seedTracker.id);
          if (!alreadyExists) {
            memoryDb.trackers.push(JSON.parse(JSON.stringify(seedTracker)));
            changed = true;
          }
        }
      }
    } catch (e) {
      console.log('No tracking seed data found');
    }
"""
content = re.sub(r'    // Merge projects — only add ones whose name doesn\'t exist yet.*?      }\n    }', merge_seed, content, flags=re.DOTALL)

crud_methods = """
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
"""

content = re.sub(r'  // --- TASKS ---', crud_methods + '\n  // --- TASKS ---', content)

with open('src/services/api.ts', 'w') as f:
    f.write(content)
