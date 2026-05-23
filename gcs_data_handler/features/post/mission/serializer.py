"""mission serializer — parse the waypoint list; build per-waypoint rows."""

import logging
from typing import Iterable, List, Optional

from Utils.models import Waypoint

log = logging.getLogger("gcs.mission.serializer")


def extract_waypoints(body) -> Optional[list]:
    """Pull the waypoint list out of the body (or the body itself if a list)."""
    waypoints = body.get("mission") if isinstance(body, dict) else body
    return waypoints if isinstance(waypoints, list) else None


def build_rows(mission_id, waypoints: Iterable[dict]) -> List[Waypoint]:
    """Skip malformed entries and warn — match the prior loose validation."""
    rows: List[Waypoint] = []
    for wp in waypoints:
        if not isinstance(wp, dict):
            continue
        try:
            rows.append(Waypoint(
                mission_id=mission_id,
                sequence=int(wp.get("sequence", 0)),
                latitude=float(wp["lat"]),
                longitude=float(wp.get("lng", wp.get("lon", wp.get("long")))),
                altitude=float(wp.get("alt", 0.0)),
                label=str(wp.get("label", "") or ""),
            ))
        except (TypeError, ValueError, KeyError) as e:
            log.warning("bad waypoint %r: %s", wp, e)
    return rows
