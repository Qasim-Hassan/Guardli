from dotenv import load_dotenv
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

## For development environment
class Settings(BaseSettings):
    google_api_key: str

    class Config:
        env_file = ".env"

# model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

settings = Settings()

load_dotenv()

# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")  — use for production
GOOGLE_API_KEY = settings.google_api_key # use for development
MODEL_NAME = "gemma-4-31b-it"