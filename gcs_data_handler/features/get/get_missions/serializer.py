"""get_missions serializer — list-form summary of every mission."""

from datetime import datetime, timezone


def build_missions_list(missions, bot) -> dict:
    active_id = str(bot.mission_id) if (bot is not None and bot.mission_id) else None
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "bot_id": str(bot.id) if bot else None,
        "active_mission_id": active_id,
        "missions": [_summarize(m, active_id) for m in missions],
    }


def _summarize(m, active_id: str | None) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "description": m.description,
        "status": m.status,
        "started_at": m.started_at.isoformat() if m.started_at else None,
        "ended_at": m.ended_at.isoformat() if m.ended_at else None,
        "modified_at": m.modified_at.isoformat() if m.modified_at else None,
        "waypoint_count": len(m.waypoints),
        "is_active": str(m.id) == active_id,
    }
