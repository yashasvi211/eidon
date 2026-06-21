# routers/settings.py
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("")
def read_settings(conn = Depends(get_db)):
    try:
        return crud.get_settings(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("")
def update_settings(payload: schemas.SettingsUpdate, conn = Depends(get_db)):
    try:
        crud.update_settings(conn, payload)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
