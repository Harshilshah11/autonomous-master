"""
mission_status serializer — current mission's progress + remaining distance.

`build_mission_status(bot)` walks the bound session's relationships
(`bot.mission`, `mission.waypoints`) and computes distance-to-next and
total-remaining along the unreached leg of the route.
"""

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Optional

_EARTH_R_M = 6_371_000.0


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Great-circle distance in metres between two lat/lon points."""
    if None in (lat1, lon1, lat2, lon2):
        return 0.0
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * _EARTH_R_M * asin(sqrt(a))


def build_mission_status(bot) -> dict:
    """Format the current mission as the response body (None if no mission)."""
    mission_info = None
    if bot is not None and bot.mission is not None:
        mission_info = _build_mission_info(bot, bot.mission)
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "bot_id": str(bot.id) if bot else None,
        "mission": mission_info,
    }


def _build_mission_info(bot, mission) -> dict:
    waypoints = sorted(mission.waypoints, key=lambda w: w.sequence)
    wp_list = [
        {
            "sequence": wp.sequence,
            "lat": wp.latitude,
            "lng": wp.longitude,
            "alt": wp.altitude,
            "label": wp.label,
            "reached_at": wp.reached_at.isoformat() if wp.reached_at else None,
            "reached": wp.reached_at is not None,
        }
        for wp in waypoints
    ]
    reached_count = sum(1 for wp in wp_list if wp["reached"])
    total = len(wp_list)

    # Distance to next unreached waypoint + total remaining along route.
    remaining = [wp for wp in waypoints if wp.reached_at is None]
    dist_to_next_m: Optional[float] = None
    dist_remaining_m = 0.0
    if remaining and bot.lat is not None and bot.long is not None:
        dist_to_next_m = _haversine_m(
            bot.lat, bot.long, remaining[0].latitude, remaining[0].longitude
        )
        dist_remaining_m = dist_to_next_m
        for a, b in zip(remaining, remaining[1:]):
            dist_remaining_m += _haversine_m(
                a.latitude, a.longitude, b.latitude, b.longitude
            )

    return {
        "id": str(mission.id),
        "name": mission.name,
        "status": mission.status,
        "started_at": mission.started_at.isoformat() if mission.started_at else None,
        "ended_at": mission.ended_at.isoformat() if mission.ended_at else None,
        "modified_at": mission.modified_at.isoformat() if mission.modified_at else None,
        "progress": {
            "reached": reached_count,
            "total": total,
            "percent": (reached_count / total * 100.0) if total else 0.0,
            "dist_to_next_m": dist_to_next_m,
            "dist_remaining_m": dist_remaining_m,
        },
        "waypoints": wp_list,
    }
