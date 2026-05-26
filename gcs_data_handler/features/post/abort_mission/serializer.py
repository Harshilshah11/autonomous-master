"""abort_mission serializer — no request params; format the reply detail."""


def reply_detail(mission_id: str, wp_count: int) -> str:
    return (f"mission {mission_id} aborted; reset {wp_count} waypoint(s) "
            f"(start_mission re-runs from the first waypoint)")
