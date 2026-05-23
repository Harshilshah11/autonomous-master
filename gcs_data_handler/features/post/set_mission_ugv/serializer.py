"""set_mission_ugv serializer — parse the target mission id."""

from uuid import UUID


def parse_mission_id(body: dict) -> UUID:
    raw = body.get("mission_id") or body.get("missionId") or body.get("id")
    if not raw:
        raise ValueError("missing mission_id")
    return UUID(str(raw))
