"""
waypoints.py — shared waypoint-row builder used by mission-CRUD features.

Lives at the top level (rather than inside any one feature) because more than
one POST route needs it: `create_new_mission` and `edit_mission_waypoints`.
Skips malformed entries with a warning — matches the prior loose validation.
"""

import logging
from typing import Iterable, List

from Utils.models import Waypoint

log = logging.getLogger("gcs.waypoints")


def build_rows(mission_id, waypoints: Iterable[dict]) -> List[Waypoint]:
    rows: List[Waypoint] = []
    for wp in waypoints:
        if not isinstance(wp, dict):
            continue
        try:
            halt_seconds = float(wp.get("halt_seconds", wp.get("haltSeconds", 0.0)) or 0.0)
            # A positive halt timer implies a halt, so the operator can just set
            # halt_seconds without also remembering to set halt.
            halt = bool(wp.get("halt", False)) or halt_seconds > 0
            rows.append(Waypoint(
                mission_id=mission_id,
                sequence=int(wp.get("sequence", 0)),
                latitude=float(wp["lat"]),
                longitude=float(wp.get("lng", wp.get("lon", wp.get("long")))),
                altitude=float(wp.get("alt", 0.0)),
                label=str(wp.get("label", "") or ""),
                halt=halt,
                halt_seconds=halt_seconds,
            ))
        except (TypeError, ValueError, KeyError) as e:
            log.warning("bad waypoint %r: %s", wp, e)
    return rows
