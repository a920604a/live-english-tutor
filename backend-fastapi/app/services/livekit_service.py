from livekit.api import AccessToken, VideoGrants

from app.config import settings


def generate_token(room_name: str, participant_identity: str, participant_name: str) -> str:
    token = (
        AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )
    return token
