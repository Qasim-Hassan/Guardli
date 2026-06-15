from fastapi import FastAPI

from app.schemas import (
    ModerationRequest,
    ModerationResponse
)

from app.moderator import moderate


app = FastAPI(
    title="Guardli"
)


@app.post(
    "/moderate",
    response_model=ModerationResponse
)
def moderate_content(
    request: ModerationRequest
):

    result = moderate(
        request.title,
        request.body
    )

    return result