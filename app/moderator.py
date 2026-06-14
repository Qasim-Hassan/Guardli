from app.ai import classify_content
from app.spam import detect_spam


def moderate(title: str, body: str):

    content = f"{title}\n\n{body}"

    if detect_spam(content):
        return {
            "decision": "REMOVE",
            "rule": "SPAM",
            "confidence": 1.0,
            "reason": "Matched spam rules"
        }

    result = classify_content(content)

    return result