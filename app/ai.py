import json

from google import genai

from app.config import (
    GOOGLE_API_KEY,
    MODEL_NAME
)

from app.prompts import SYSTEM_PROMPT


client = genai.Client(
    api_key=GOOGLE_API_KEY
)


def classify_content(text: str):

    prompt = f"""
{SYSTEM_PROMPT}

Content:

{text}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )

    raw = response.text.strip()

    raw = raw.replace("```json", "")
    raw = raw.replace("```", "")
    raw = raw.strip()

    return json.loads(raw)