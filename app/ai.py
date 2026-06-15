import json
import random

from google import genai

from app.config import (
    API_KEYS,
    MODEL_NAME
)

from app.prompts import SYSTEM_PROMPT

def classify_content(text: str):
    ## To allow rotating through API keys in case of errors

    keys = API_KEYS.copy()
    random.shuffle(keys)

    prompt = f"""
{SYSTEM_PROMPT}

Content:

{text}
"""
    
    for key in keys:
        try:
            client = genai.Client(
                api_key=key
            )

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt
            )

            raw = response.text.strip()

            raw = raw.replace("```json", "")
            raw = raw.replace("```", "")
            raw = raw.strip()

            return json.loads(raw)

        except Exception as e:
            print("Error with API key")
            continue

    return {
        "decision": "APPROVE",
        "rule": "null",
        "confidence": 0.0,
        "reason": "No response from AI"
    }