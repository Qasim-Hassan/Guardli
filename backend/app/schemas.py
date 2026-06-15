from pydantic import BaseModel
from typing import Optional


class ModerationRequest(BaseModel):
    title: str = ""
    body: str


class ModerationResponse(BaseModel):
    decision: str
    rule: Optional[str]
    confidence: float
    reason: str