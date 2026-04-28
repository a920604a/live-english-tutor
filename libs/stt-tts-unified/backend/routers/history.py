import logging
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.history_service import history_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_history(
    type: Optional[Literal["tts", "stt", "all"]] = Query("all"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if type == "all" or type is None:
        records = await history_service.list_all(limit=limit, offset=offset)
    else:
        records = await history_service.list_by_type(type, limit=limit, offset=offset)
    return {"records": records, "total": len(records)}


@router.delete("/{record_type}/{record_id}")
async def delete_record(
    record_type: Literal["tts", "stt"],
    record_id: int,
):
    deleted = await history_service.delete(record_type, record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="紀錄不存在")
    return {"success": True}
