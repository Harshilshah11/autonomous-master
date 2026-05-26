"""create_new_mission serializer — parse the new-mission body."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List


@dataclass
class NewMission:
    name: str
    description: str
    waypoints: List[dict]
    max_cruise_speed: float   # m/s; 0 = unset


def parse_max_cruise_speed(body: dict) -> float:
    """Non-negative cruise cap in m/s. Missing/invalid -> 0.0 (unset)."""
    raw = body.get("max_cruise_speed", body.get("maxCruiseSpeed", 0.0))
    try:
        return max(0.0, float(raw))
    except (TypeError, ValueError):
        return 0.0


def parse(body: dict) -> NewMission:
    """Pull out name/description/waypoints/max_cruise_speed. Auto-name if missing."""
    name = str(body.get("name") or "").strip()
    if not name:
        name = f"mission-{datetime.now(timezone.utc).isoformat(timespec='seconds')}"
    description = str(body.get("description") or "")
    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list):
        waypoints = []
    return NewMission(name=name, description=description, waypoints=waypoints,
                      max_cruise_speed=parse_max_cruise_speed(body))
