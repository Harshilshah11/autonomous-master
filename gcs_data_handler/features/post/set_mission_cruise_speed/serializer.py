"""set_mission_cruise_speed serializer — parse (mission_id, max_cruise_speed)."""

from typing import Tuple
from uuid import UUID


def parse(body: dict) -> Tuple[UUID, float]:
    """Return (mission_id, max_cruise_speed).

    max_cruise_speed is a non-negative m/s float (0 = unset -> CustomNav falls
    back to its CLI default). Raises ValueError on bad input.
    """
    raw_id = body.get("mission_id") or body.get("missionId") or body.get("id")
    if not raw_id:
        raise ValueError("missing mission_id")

    if "max_cruise_speed" not in body and "maxCruiseSpeed" not in body:
        raise ValueError("missing max_cruise_speed")
    raw = body.get("max_cruise_speed", body.get("maxCruiseSpeed"))
    try:
        max_cruise_speed = max(0.0, float(raw))
    except (TypeError, ValueError):
        raise ValueError("max_cruise_speed must be a number")

    return UUID(str(raw_id)), max_cruise_speed
