from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Firebase Auth
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""   # Service Account JSON as single-line string
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""   # Or local path to JSON file (pick one)

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://tutor:tutor@localhost:5432/tutordb"

    # LiveKit Cloud
    LIVEKIT_URL: str = "wss://your-project.livekit.cloud"
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # Ollama 外部伺服器
    OLLAMA_BASE_URL: str = "http://192.168.15.235:11434/v1"
    OLLAMA_MODEL: str = "qwen3.5:35b"

    # Internal agent secret
    INTERNAL_SECRET: str = "internal-agent-secret"


settings = Settings()
