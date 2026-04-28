from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Directories (relative to project root)
    upload_dir: str = "data/uploads"
    result_dir: str = "data/results"
    audio_dir: str = "data/audio"
    db_path: str = "data/history.db"
    frontend_build_dir: str = "frontend/dist"

    # Limits
    max_file_size_mb: int = 500

    # Whisper
    default_whisper_model: str = "base"

    # TTS
    default_tts_voice: str = "zh-TW-YunJheNeural"

    # Dev
    dev_mode: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self) -> None:
        for d in [self.upload_dir, self.result_dir, self.audio_dir]:
            Path(d).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
