"""create_new_mission serializer — parse the new-mission body."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List


@dataclass
class NewMission:
    name: str
    description: str
    waypoints: List[dict]


def parse(body: dict) -> NewMission:
    """Pull out name/description/waypoints. Auto-name if missing."""
    name = str(body.get("name") or "").strip()
    if not name:
        name = f"mission-{datetime.now(timezone.utc).isoformat(timespec='seconds')}"
    description = str(body.get("description") or "")
    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list):
        waypoints = []
    return NewMission(name=name, description=description, waypoints=waypoints)
