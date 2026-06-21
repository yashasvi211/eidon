# app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app import crud
from app import schemas

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

@router.get("", response_model=dict)
def read_tasks(conn = Depends(get_db)):
    try:
        return crud.get_all_tasks(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_task(task: schemas.TaskCreate, conn = Depends(get_db)):
    try:
        task_id = crud.create_task(conn, task)
        return {"status": "success", "id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{task_id}")
def update_task(task_id: str, updates: schemas.TaskUpdate, conn = Depends(get_db)):
    try:
        success = crud.update_task(conn, task_id, updates)
        if not success:
            raise HTTPException(status_code=400, detail="No fields to update")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{task_id}")
def delete_task(task_id: str, conn = Depends(get_db)):
    try:
        crud.delete_task(conn, task_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SUBTASKS ---

@router.post("/{task_id}/subtasks")
def create_subtask(task_id: str, subtask: schemas.SubtaskCreate, conn = Depends(get_db)):
    try:
        subtask_id = crud.create_subtask(conn, task_id, subtask)
        return {"status": "success", "id": subtask_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{task_id}/subtasks/{subtask_id}")
def update_subtask(task_id: str, subtask_id: str, updates: schemas.SubtaskUpdate, conn = Depends(get_db)):
    try:
        success = crud.update_subtask(conn, task_id, subtask_id, updates)
        if not success:
            raise HTTPException(status_code=400, detail="No fields to update")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{task_id}/subtasks/{subtask_id}")
def delete_subtask(task_id: str, subtask_id: str, conn = Depends(get_db)):
    try:
        crud.delete_subtask(conn, task_id, subtask_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- TIMER SESSIONS ---

@router.post("/{task_id}/sessions")
def create_session(task_id: str, session: schemas.SessionCreate, conn = Depends(get_db)):
    try:
        session_id = crud.create_session(conn, task_id, session)
        return {"status": "success", "id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- AUDIT LOGS ---

@router.post("/{task_id}/audit_logs")
def create_audit_log(task_id: str, log: schemas.AuditLogCreate, conn = Depends(get_db)):
    try:
        log_id = crud.create_audit_log(conn, task_id, log)
        return {"status": "success", "id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
