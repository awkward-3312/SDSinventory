import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

try:
    from pydantic import BaseSettings, Field  # pydantic v1
except Exception:  # pragma: no cover - fallback for pydantic v2
    try:
        from pydantic_settings import BaseSettings  # type: ignore
        from pydantic import Field  # type: ignore
    except Exception:  # pragma: no cover
        BaseSettings = None  # type: ignore
        Field = None  # type: ignore


if BaseSettings:
    class Settings(BaseSettings):
        DATABASE_URL: str = Field("", env="DATABASE_URL")
        ALLOWED_ORIGINS: str = Field("http://localhost:3000", env="ALLOWED_ORIGINS")

        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            case_sensitive = False
else:
    class Settings:  # type: ignore
        def __init__(self) -> None:
            self.DATABASE_URL = os.getenv("DATABASE_URL", "")
            self.ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()  # type: ignore
    return settings
