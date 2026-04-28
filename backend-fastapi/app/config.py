from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Firebase Auth
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""   # Service Account JSON as single-line string
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""   # Or local path to JSON file (pick one)

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://tutor:tutor@localhost:5432/tutordb"

    # LiveKit
    LIVEKIT_URL: str = "wss://your-project.livekit.cloud"
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""
    # Self-hosted 模式：設定此值，backend 會將其回傳給前端（瀏覽器）作為連線 URL。
    # 這樣可以區分「Agent 使用的 Docker 內部 URL」與「瀏覽器使用的外部 URL」。
    # Cloud 模式：留空，自動 fallback 到 LIVEKIT_URL。
    LIVEKIT_PUBLIC_URL: str = ""

    # Google Gemini（Agent Realtime 用）
    GOOGLE_API_KEY: str = ""

    # Ollama（報告生成用）
    OLLAMA_BASE_URL: str = "http://192.168.15.235:11434/v1"
    OLLAMA_MODEL: str = "gemma4:e2b"

    # Internal agent secret
    INTERNAL_SECRET: str = "internal-agent-secret"

    # Feature toggles
    ENABLE_REPORT_GENERATION: bool = False

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "live-english-tutor-materials"
    R2_ENDPOINT_URL: str = ""   # https://<ACCOUNT_ID>.r2.cloudflarestorage.com

    # stt-tts-unified TTS service (Docker internal)
    TTS_SERVICE_URL: str = "http://tts:8000"
    TTS_VOICE: str = "en-US-JennyNeural"
    TTS_CACHE_DIR: str = "/app/tts_cache"


settings = Settings()
