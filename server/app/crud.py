# app/crud.py
import json
from psycopg2.extras import RealDictCursor
from app.schemas import (
    TaskCreate, TaskUpdate, 
    SubtaskCreate, SubtaskUpdate, 
    SessionCreate, AuditLogCreate, 
    ProjectSchema, SettingsUpdate
)

# ============================================================
# PROJECTS CRUD
# ============================================================

def get_all_projects(conn):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM projects;")
    return cur.fetchall()

def create_project(conn, project: ProjectSchema):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO projects (name, color)
        VALUES (%s, %s)
        ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color;
        """,
        (project.name, project.color)
    )
    conn.commit()
    print(f"[DB WRITE] Project '{project.name}' successfully added/updated.")

def delete_project(conn, name: str):
    cur = conn.cursor()
    cur.execute("UPDATE tasks SET project = 'Inbox' WHERE project = %s;", (name,))
    cur.execute("DELETE FROM projects WHERE name = %s;", (name,))
    conn.commit()
    print(f"[DB WRITE] Project '{name}' successfully deleted. Associated tasks reassigned to 'Inbox'.")

# ============================================================
# TASKS CRUD
# ============================================================

def get_all_tasks(conn):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch all tasks
    cur.execute("SELECT * FROM tasks ORDER BY created_at ASC;")
    tasks_rows = cur.fetchall()
    
    # 2. Fetch all subtasks
    cur.execute("SELECT * FROM subtasks;")
    subtasks_rows = cur.fetchall()
    
    # 3. Fetch all sessions
    cur.execute("SELECT * FROM sessions;")
    sessions_rows = cur.fetchall()
    
    # 4. Fetch all audit logs
    cur.execute("SELECT * FROM audit_logs ORDER BY timestamp ASC;")
    audit_logs_rows = cur.fetchall()
    
    # Group subtasks, sessions, audit logs by task_id
    subtasks_by_task = {}
    for sub in subtasks_rows:
        tid = sub["task_id"]
        if tid not in subtasks_by_task:
            subtasks_by_task[tid] = []
        subtasks_by_task[tid].append({
            "id": sub["id"],
            "title": sub["title"],
            "done": sub["done"]
        })
        
    sessions_by_task = {}
    for sess in sessions_rows:
        tid = sess["task_id"]
        if tid not in sessions_by_task:
            sessions_by_task[tid] = []
        sessions_by_task[tid].append({
            "id": sess["id"],
            "start": sess["start_time"],
            "end": sess["end_time"],
            "note": sess["note"],
            "subtasksCompleted": sess["subtasks_completed"] or []
        })
        
    audit_logs_by_task = {}
    for log in audit_logs_rows:
        tid = log["task_id"]
        if tid not in audit_logs_by_task:
            audit_logs_by_task[tid] = []
        audit_logs_by_task[tid].append({
            "id": log["id"],
            "timestamp": log["timestamp"],
            "action": log["action"],
            "details": log["details"] or {}
        })
        
    # Construct task list
    tasks_list = []
    for t in tasks_rows:
        tid = t["id"]
        tasks_list.append({
            "id": tid,
            "title": t["title"],
            "project": t["project"] or "Inbox",
            "due": t["due"] or "",
            "est": t["est"] or "",
            "notes": t["notes"] or "",
            "done": t["done"],
            "target": t["target"] or "today",
            "createdAt": t["created_at"],
            "completedAt": t["completed_at"],
            "subtasks": subtasks_by_task.get(tid, []),
            "sessions": sessions_by_task.get(tid, []),
            "auditLog": audit_logs_by_task.get(tid, [])
        })
        
    return {"tasks": tasks_list}

def create_task(conn, task: TaskCreate):
    cur = conn.cursor()
    project_name = task.project or "Inbox"
    cur.execute("SELECT COUNT(*) FROM projects WHERE name = %s;", (project_name,))
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO projects (name, color) VALUES (%s, %s);", (project_name, "#8b949e"))
        
    cur.execute(
        """
        INSERT INTO tasks (id, title, project, due, est, notes, done, target, created_at, completed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            project = EXCLUDED.project,
            due = EXCLUDED.due,
            est = EXCLUDED.est,
            notes = EXCLUDED.notes,
            done = EXCLUDED.done,
            target = EXCLUDED.target,
            completed_at = EXCLUDED.completed_at;
        """,
        (
            task.id,
            task.title,
            project_name,
            task.due or "",
            task.est or "",
            task.notes or "",
            task.done or False,
            task.target or "today",
            task.createdAt,
            task.completedAt
        )
    )
    conn.commit()
    print(f"[DB WRITE] Task '{task.id}' (Title: '{task.title}') successfully created/updated in Project '{project_name}'.")
    return task.id

def update_task(conn, task_id: str, updates: TaskUpdate):
    cur = conn.cursor()
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return False
        
    fields = []
    values = []
    for k, v in update_data.items():
        db_key = k
        if k == "createdAt":
            db_key = "created_at"
        elif k == "completedAt":
            db_key = "completed_at"
        fields.append(f"{db_key} = %s")
        values.append(v)
        
    values.append(task_id)
    query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = %s"
    
    cur.execute(query, tuple(values))
    conn.commit()
    print(f"[DB WRITE] Task '{task_id}' attributes successfully updated: {list(update_data.keys())}.")
    return True

def delete_task(conn, task_id: str):
    cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    conn.commit()
    print(f"[DB WRITE] Task '{task_id}' successfully deleted.")

# ============================================================
# SUBTASKS CRUD
# ============================================================

def create_subtask(conn, task_id: str, subtask: SubtaskCreate):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO subtasks (id, task_id, title, done)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, done = EXCLUDED.done;
        """,
        (subtask.id, task_id, subtask.title, subtask.done or False)
    )
    conn.commit()
    print(f"[DB WRITE] Subtask '{subtask.id}' (Title: '{subtask.title}') successfully added/updated to Task '{task_id}'.")
    return subtask.id

def update_subtask(conn, task_id: str, subtask_id: str, updates: SubtaskUpdate):
    cur = conn.cursor()
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return False
        
    fields = []
    values = []
    for k, v in update_data.items():
        fields.append(f"{k} = %s")
        values.append(v)
        
    values.extend([subtask_id, task_id])
    query = f"UPDATE subtasks SET {', '.join(fields)} WHERE id = %s AND task_id = %s"
    
    cur.execute(query, tuple(values))
    conn.commit()
    print(f"[DB WRITE] Subtask '{subtask_id}' for Task '{task_id}' successfully updated: {list(update_data.keys())}.")
    return True

def delete_subtask(conn, task_id: str, subtask_id: str):
    cur = conn.cursor()
    cur.execute("DELETE FROM subtasks WHERE id = %s AND task_id = %s", (subtask_id, task_id))
    conn.commit()
    print(f"[DB WRITE] Subtask '{subtask_id}' successfully deleted from Task '{task_id}'.")

# ============================================================
# TIMER SESSIONS CRUD
# ============================================================

def create_session(conn, task_id: str, session: SessionCreate):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO sessions (id, task_id, start_time, end_time, note, subtasks_completed)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET 
            start_time = EXCLUDED.start_time, 
            end_time = EXCLUDED.end_time, 
            note = EXCLUDED.note, 
            subtasks_completed = EXCLUDED.subtasks_completed;
        """,
        (
            session.id,
            task_id,
            session.start,
            session.end,
            session.note,
            json.dumps(session.subtasksCompleted or [])
        )
    )
    conn.commit()
    print(f"[DB WRITE] Timer Session '{session.id}' (Duration: {round((session.end - session.start)/1000)}s) successfully logged to Task '{task_id}'.")
    return session.id

# ============================================================
# AUDIT LOGS CRUD
# ============================================================

def create_audit_log(conn, task_id: str, log: AuditLogCreate):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO audit_logs (id, task_id, timestamp, action, details)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
        """,
        (
            log.id,
            task_id,
            log.timestamp,
            log.action,
            json.dumps(log.details or {})
        )
    )
    conn.commit()
    print(f"[DB WRITE] Audit Log entry '{log.id}' (Action: '{log.action}') successfully saved for Task '{task_id}'.")
    return log.id

# ============================================================
# SETTINGS CRUD
# ============================================================

def get_settings(conn):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM settings;")
    rows = cur.fetchall()
    
    settings_dict = {}
    for row in rows:
        settings_dict[row["key"]] = row["value"]
        
    return {
        "settings": settings_dict.get("app_settings", {
            "appSize": 100,
            "showCompleted": True,
            "sleepStart": "22:00",
            "sleepEnd": "07:00"
        }),
        "isSleeping": settings_dict.get("is_sleeping", False),
        "sleepStartTime": settings_dict.get("sleep_start_time", None)
    }

def update_settings(conn, payload: SettingsUpdate):
    cur = conn.cursor()
    payload_data = payload.model_dump(exclude_unset=True)
    if not payload_data:
        return
        
    for key, value in payload_data.items():
        db_key = key
        if key == "isSleeping":
            db_key = "is_sleeping"
        elif key == "sleepStartTime":
            db_key = "sleep_start_time"
        elif key == "settings":
            db_key = "app_settings"
            
        cur.execute(
            """
            INSERT INTO settings (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """,
            (db_key, json.dumps(value))
        )
    conn.commit()
    print(f"[DB WRITE] Settings configuration updated successfully for fields: {list(payload_data.keys())}.")
