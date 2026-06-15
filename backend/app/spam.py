import re


SPAM_PATTERNS = [
    r"free money",
    r"earn \$\d+",
    r"crypto giveaway",
    r"click here",
    r"telegram.*join",
]


def detect_spam(text: str):
    lowered = text.lower()

    for pattern in SPAM_PATTERNS:
        if re.search(pattern, lowered):
            return True

    return False