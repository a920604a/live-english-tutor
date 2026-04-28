import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Dict, Optional

import aiofiles
from fastapi import UploadFile

from ..config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()


class FileHandler:
    def __init__(self):
        self.upload_dir = _settings.upload_dir
        self.result_dir = _settings.result_dir
        self.max_file_size = _settings.max_file_size_mb * 1024 * 1024

        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.result_dir, exist_ok=True)

    async def save_upload(self, file: UploadFile, file_content: bytes) -> str:
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        stored_filename = f"{file_id}{file_extension}"
        file_path = os.path.join(self.upload_dir, stored_filename)

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_content)

        metadata = {
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "file_size": len(file_content),
            "file_extension": file_extension,
        }
        await self._save_metadata(file_id, metadata)

        logger.info(f"檔案已保存: {file.filename} -> {file_id}")
        return file_id

    async def get_file_info(self, file_id: str) -> Dict:
        metadata = await self._load_metadata(file_id)
        if not metadata:
            raise FileNotFoundError(f"檔案不存在: {file_id}")

        file_size_mb = metadata["file_size"] / (1024 * 1024)
        estimated_time = max(0.5, file_size_mb / 10)

        return {
            "filename": metadata["original_filename"],
            "size": metadata["file_size"],
            "estimated_processing_time": round(estimated_time, 1),
        }

    async def file_exists(self, file_id: str) -> bool:
        metadata = await self._load_metadata(file_id)
        if not metadata:
            return False
        file_path = os.path.join(self.upload_dir, metadata["stored_filename"])
        return os.path.exists(file_path)

    async def get_result_file(self, file_id: str) -> str:
        result_path = os.path.join(self.result_dir, f"{file_id}_text.txt")
        if not os.path.exists(result_path):
            raise FileNotFoundError(f"結果檔案不存在")
        return result_path

    async def get_file_path(self, file_id: str) -> str:
        metadata = await self._load_metadata(file_id)
        if not metadata:
            raise FileNotFoundError(f"檔案不存在: {file_id}")
        return os.path.join(self.upload_dir, metadata["stored_filename"])

    async def get_original_filename(self, file_id: str) -> str:
        metadata = await self._load_metadata(file_id)
        if not metadata:
            return "unknown"
        return metadata.get("original_filename", "unknown")

    async def get_stored_filename(self, file_id: str) -> str:
        metadata = await self._load_metadata(file_id)
        if not metadata:
            return ""
        return metadata.get("stored_filename", "")

    async def get_processing_status(self, file_id: str) -> Dict:
        if not await self.file_exists(file_id):
            return {
                "status": "file_not_found",
                "message": "檔案不存在",
                "progress": 0,
                "stage": "錯誤",
            }

        status_path = os.path.join(self.upload_dir, f"{file_id}_status.json")
        if os.path.exists(status_path):
            async with aiofiles.open(status_path, "r", encoding="utf-8") as f:
                return json.loads(await f.read())

        result_path = os.path.join(self.result_dir, f"{file_id}_text.txt")
        if os.path.exists(result_path):
            return {"status": "completed", "message": "轉換完成", "progress": 100, "stage": "完成"}

        return {"status": "processing", "message": "正在處理中", "progress": 30, "stage": "音頻處理中"}

    async def update_processing_status(
        self,
        file_id: str,
        status: str,
        progress: int,
        stage: str,
        message: str = "",
        processing_time: float = 0.0,
    ):
        status_data = {
            "status": status,
            "progress": progress,
            "stage": stage,
            "message": message,
            "timestamp": time.time(),
            "processing_time": processing_time,
        }
        status_path = os.path.join(self.upload_dir, f"{file_id}_status.json")
        async with aiofiles.open(status_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(status_data, ensure_ascii=False, indent=2))
        logger.info(f"更新狀態 {file_id}: {status} - {progress}% - {stage}")

    async def cleanup_status(self, file_id: str):
        status_path = os.path.join(self.upload_dir, f"{file_id}_status.json")
        if os.path.exists(status_path):
            os.remove(status_path)

    async def _save_metadata(self, file_id: str, metadata: Dict):
        metadata_path = os.path.join(self.upload_dir, f"{file_id}_metadata.json")
        async with aiofiles.open(metadata_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(metadata, ensure_ascii=False, indent=2))

    async def _load_metadata(self, file_id: str) -> Optional[Dict]:
        metadata_path = os.path.join(self.upload_dir, f"{file_id}_metadata.json")
        try:
            async with aiofiles.open(metadata_path, "r", encoding="utf-8") as f:
                return json.loads(await f.read())
        except (FileNotFoundError, json.JSONDecodeError):
            return None
