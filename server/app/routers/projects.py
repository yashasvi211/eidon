# app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database import get_db
from app import crud
from app import schemas

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.get("", response_model=List[schemas.ProjectSchema])
def read_projects(conn = Depends(get_db)):
    try:
        return crud.get_all_projects(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_project(project: schemas.ProjectSchema, conn = Depends(get_db)):
    try:
        crud.create_project(conn, project)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}")
def delete_project(name: str, conn = Depends(get_db)):
    try:
        crud.delete_project(conn, name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
