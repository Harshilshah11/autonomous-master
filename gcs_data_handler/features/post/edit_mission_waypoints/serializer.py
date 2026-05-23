"""edit_mission_waypoints serializer — parse the (mission_id, waypoints) body."""

from typing import Tuple
from uuid import UUID

# Reuse waypoint helpers from the legacy POST /mission feature; they have the
# loose-validation behaviour we want (skip malformed entries, warn).
from features.post.mission.serializer import build_rows, extract_waypoints


def parse(body: dict) -> Tuple[UUID, list]:
    """Return (mission_id, waypoints-list). Raises ValueError on bad input."""
    raw_id = body.get("mission_id") or body.get("missionId") or body.get("id")
    if not raw_id:
        raise ValueError("missing mission_id")
    # Accept either {"waypoints":[...]} or {"mission":[...]} (legacy shape).
    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list):
        waypoints = extract_waypoints(body)
    if not isinstance(waypoints, list):
        raise ValueError("waypoints must be a list (under 'waypoints' or 'mission')")
    return UUID(str(raw_id)), waypoints


__all__ = ["parse", "build_rows"]
