-- app/schema/schema.sql
-- Database schema for Eidon Task and Time Tracker

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    name VARCHAR(255) PRIMARY KEY,
    color VARCHAR(50) NOT NULL
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    project VARCHAR(255) REFERENCES projects(name) ON DELETE SET NULL,
    due VARCHAR(50),
    est VARCHAR(50),
    notes TEXT,
    done BOOLEAN DEFAULT FALSE,
    target VARCHAR(50) DEFAULT 'today',
    created_at BIGINT NOT NULL,
    completed_at BIGINT
);

-- 3. Subtasks Table
CREATE TABLE IF NOT EXISTS subtasks (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE
);

-- 4. Sessions Table (Timer Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    note TEXT,
    subtasks_completed JSONB DEFAULT '[]'::jsonb
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb
);

-- 6. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL
);

-- Pre-populate default projects
INSERT INTO projects (name, color) VALUES
('HubSpot Integration', '#58a6ff'),
('Bill of Material', '#3fb950'),
('GitHub Logs Backup', '#bc8cff'),
('Inbox', '#8b949e')
ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color;
