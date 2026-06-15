from dotenv import load_dotenv
import os

load_dotenv()

API_KEYS = [
    os.getenv("API_KEY_1"),
    os.getenv("API_KEY_2"),
    os.getenv("API_KEY_3"),
    os.getenv("API_KEY_4"),
    os.getenv("API_KEY_5"),
]

API_KEYS = [
    key for key in API_KEYS
    if key and key.strip()
]

if not API_KEYS:
    raise ValueError("No API keys configured")

MODEL_NAME = "gemma-4-31b-it"