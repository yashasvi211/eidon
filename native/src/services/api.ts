// native/src/services/api.ts
import { Task, Session, AuditEntry } from "../components/DetailPanel";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error in request to ${path}:`, error);
    throw error;
  }
}

export const api = {
  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    const data = await request("/api/tasks");
    return data.tasks || [];
  },

  async createTask(task: Partial<Task>): Promise<void> {
    await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        project: task.project || "Inbox",
        due: task.due || "",
        est: task.est || "",
        notes: task.notes || "",
        done: task.done || false,
        target: task.target || "today",
        createdAt: task.createdAt || Date.now(),
        completedAt: task.completedAt || null,
      }),
    });
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    await request(`/api/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: updates.title,
        project: updates.project,
        due: updates.due,
        est: updates.est,
        notes: updates.notes,
        done: updates.done,
        target: updates.target,
        completedAt: updates.completedAt,
      }),
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
  },

  // --- SUBTASKS ---
  async createSubtask(taskId: string, subtask: { id: string; title: string; done?: boolean }): Promise<void> {
    await request(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({
        id: subtask.id,
        title: subtask.title,
        done: subtask.done || false,
      }),
    });
  },

  async updateSubtask(taskId: string, subtaskId: string, updates: { title?: string; done?: boolean }): Promise<void> {
    await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: updates.title,
        done: updates.done,
      }),
    });
  },

  async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    });
  },

  // --- SESSIONS ---
  async createSession(taskId: string, session: Session): Promise<void> {
    await request(`/api/tasks/${taskId}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: session.id,
        start: session.start,
        end: session.end,
        note: session.note || "",
        subtasksCompleted: session.subtasksCompleted || [],
      }),
    });
  },

  // --- AUDIT LOGS ---
  async createAuditLog(taskId: string, entry: AuditEntry): Promise<void> {
    await request(`/api/tasks/${taskId}/audit_logs`, {
      method: "POST",
      body: JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp,
        action: entry.action,
        details: entry.details || {},
      }),
    });
  },

  // --- PROJECTS ---
  async getProjects(): Promise<{ name: string; color: string }[]> {
    return await request("/api/projects");
  },

  async createProject(project: { name: string; color: string }): Promise<void> {
    await request("/api/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
  },

  async deleteProject(projectName: string): Promise<void> {
    await request(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: "DELETE",
    });
  },

  // --- SETTINGS ---
  async getSettings(): Promise<{ settings: any; isSleeping: boolean; sleepStartTime: number | null }> {
    return await request("/api/settings");
  },

  async updateSettings(payload: { settings?: any; isSleeping?: boolean; sleepStartTime?: number | null }): Promise<void> {
    await request("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};
