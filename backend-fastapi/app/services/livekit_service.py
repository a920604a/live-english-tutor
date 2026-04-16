import logging

from livekit.api import AccessToken, LiveKitAPI, VideoGrants
from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest
from livekit.protocol.room import CreateRoomRequest, RoomConfiguration

from app.config import settings

logger = logging.getLogger(__name__)


async def ensure_room_and_dispatch(room_name: str) -> None:
    """Pre-create the LiveKit room and explicitly dispatch the agent worker.

    This is more reliable than relying solely on RoomAgentDispatch embedded in
    the participant token, which only fires on room creation and can be lost if
    no worker is registered at that exact moment.
    """
    lk = LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    try:
        # Idempotent — safe to call even if the room already exists.
        await lk.room.create_room(CreateRoomRequest(name=room_name))
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(room=room_name, agent_name="")
        )
        logger.info("Agent dispatched to room %s", room_name)
    except Exception:
        # Log but do not block the user from joining.
        logger.exception("Failed to pre-dispatch agent for room %s", room_name)
    finally:
        await lk.aclose()


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
        .with_room_config(
            RoomConfiguration(
                max_participants=2,   # 1 student + 1 agent, no extra joins allowed
                empty_timeout=300,    # destroy room 5 min after everyone leaves
                departure_timeout=30, # end session 30 s after student disconnects
            )
        )
        .to_jwt()
    )
    return token
