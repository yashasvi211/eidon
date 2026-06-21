# schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Any

# --- SUBTASKS ---
class SubtaskSchema(BaseModel):
    id: str
    title: str
    done: bool

class SubtaskCreate(BaseModel):
    id: str
    title: str
    done: Optional[bool] = False

class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None

# --- SESSIONS ---
class SessionSchema(BaseModel):
    id: str
    start: int
    end: int
    note: Optional[str] = None
    subtasksCompleted: Optional[List[Any]] = []

class SessionCreate(BaseModel):
    id: str
    start: int
    end: int
    note: Optional[str] = None
    subtasksCompleted: Optional[List[Any]] = []

# --- AUDIT LOGS ---
class AuditLogSchema(BaseModel):
    id: str
    timestamp: int
    action: str
    details: Optional[dict] = {}

class AuditLogCreate(BaseModel):
    id: str
    timestamp: int
    action: str
    details: Optional[dict] = {}

# --- TASKS ---
class TaskSchema(BaseModel):
    id: str
    title: str
    project: str = "Inbox"
    due: str = ""
    est: str = ""
    notes: str = ""
    done: bool = False
    target: str = "today"
    createdAt: int
    completedAt: Optional[int] = None
    subtasks: List[SubtaskSchema] = []
    sessions: List[SessionSchema] = []
    auditLog: List[AuditLogSchema] = []

class TaskCreate(BaseModel):
    id: str
    title: str
    project: Optional[str] = "Inbox"
    due: Optional[str] = ""
    est: Optional[str] = ""
    notes: Optional[str] = ""
    done: Optional[bool] = False
    target: Optional[str] = "today"
    createdAt: int
    completedAt: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    project: Optional[str] = None
    due: Optional[str] = None
    est: Optional[str] = None
    notes: Optional[str] = None
    done: Optional[bool] = None
    target: Optional[str] = None
    completedAt: Optional[int] = None

# --- PROJECTS ---
class ProjectSchema(BaseModel):
    name: str
    color: str

# --- SETTINGS ---
class SettingsUpdate(BaseModel):
    settings: Optional[dict] = None
    isSleeping: Optional[bool] = None
    sleepStartTime: Optional[int] = None
