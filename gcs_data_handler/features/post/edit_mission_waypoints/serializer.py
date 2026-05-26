"""edit_mission_waypoints serializer — parse the (mission_id, waypoints) body."""

from typing import Optional, Tuple
from uuid import UUID

from waypoints import build_rows


def parse(body: dict) -> Tuple[UUID, list, Optional[float]]:
    """Return (mission_id, waypoints, max_cruise_speed).

    max_cruise_speed is None when the key is absent (leave the mission's value
    untouched); otherwise a non-negative m/s float. Raises ValueError on bad
    input.
    """
    raw_id = body.get("mission_id") or body.get("missionId") or body.get("id")
    if not raw_id:
        raise ValueError("missing mission_id")
    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list):
        raise ValueError("waypoints must be a list")

    max_cruise_speed: Optional[float] = None
    if "max_cruise_speed" in body or "maxCruiseSpeed" in body:
        raw = body.get("max_cruise_speed", body.get("maxCruiseSpeed"))
        try:
            max_cruise_speed = max(0.0, float(raw))
        except (TypeError, ValueError):
            raise ValueError("max_cruise_speed must be a number")

    return UUID(str(raw_id)), waypoints, max_cruise_speed


__all__ = ["parse", "build_rows"]
