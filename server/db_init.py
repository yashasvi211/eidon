# db_init.py
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from database import DB_HOST, DB_PORT, DB_USER, DB_NAME, DB_PASS

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME,
        sslmode="require"
    )

def init_db():
    print("Connecting to Supabase PostgreSQL database...")
    conn = get_connection()
    cur = conn.cursor()
    
    # Read schema/schema.sql
    schema_path = os.path.join(os.path.dirname(__file__), "schema", "schema.sql")
    print(f"Reading schema from {schema_path}...")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    
    # Execute schema.sql
    print("Executing schema.sql...")
    cur.execute(schema_sql)
    conn.commit()
    print("Schema initialized successfully.")
    
    # Check if tasks are already seeded
    cur.execute("SELECT COUNT(*) FROM tasks;")
    count = cur.fetchone()[0]
    
    if count > 0:
        print(f"Database already contains {count} tasks. Skipping seeding.")
        cur.close()
        conn.close()
        return
        
    # Read tasks.json
    tasks_json_path = os.path.join(os.path.dirname(__file__), "..", "..", "public", "tasks.json")
    if not os.path.exists(tasks_json_path):
        print(f"tasks.json not found at {tasks_json_path}. Cannot seed tasks.")
        cur.close()
        conn.close()
        return
        
    print(f"Reading initial data from {tasks_json_path}...")
    with open(tasks_json_path, "r") as f:
        data = json.load(f)
        
    tasks = data.get("tasks", [])
    print(f"Found {len(tasks)} tasks to seed. Seeding database...")
    
    # Keep track of projects to insert them dynamically
    projects_seen = set(["Inbox", "HubSpot Integration", "Bill of Material", "GitHub Logs Backup"])
    
    for task in tasks:
        project_name = task.get("project") or "Inbox"
        if project_name not in projects_seen:
            cur.execute(
                "INSERT INTO projects (name, color) VALUES (%s, %s) ON CONFLICT (name) DO NOTHING;",
                (project_name, "#8b949e")
            )
            projects_seen.add(project_name)
            
        # Insert task
        cur.execute(
            """
            INSERT INTO tasks (id, title, project, due, est, notes, done, target, created_at, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING;
            """,
            (
                task["id"],
                task["title"],
                project_name,
                task.get("due", ""),
                task.get("est", ""),
                task.get("notes", ""),
                task.get("done", False),
                task.get("target", "today"),
                task["createdAt"],
                task.get("completedAt")
            )
        )
        
        # Insert subtasks
        for subtask in task.get("subtasks", []):
            cur.execute(
                "INSERT INTO subtasks (id, task_id, title, done) VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING;",
                (
                    subtask["id"],
                    task["id"],
                    subtask["title"],
                    subtask.get("done", False)
                )
            )
            
        # Insert sessions
        for session in task.get("sessions", []):
            cur.execute(
                """
                INSERT INTO sessions (id, task_id, start_time, end_time, note, subtasks_completed)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """,
                (
                    session["id"],
                    task["id"],
                    session["start"],
                    session["end"],
                    session.get("note"),
                    json.dumps(session.get("subtasksCompleted", []))
                )
            )
            
        # Insert audit logs
        for log in task.get("auditLog", []):
            cur.execute(
                """
                INSERT INTO audit_logs (id, task_id, timestamp, action, details)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """,
                (
                    log["id"],
                    task["id"],
                    log["timestamp"],
                    log["action"],
                    json.dumps(log.get("details", {}))
                )
            )
            
    conn.commit()
    print("Database seeding completed successfully.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    init_db()
