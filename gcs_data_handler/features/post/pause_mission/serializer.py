"""pause_mission serializer — no request params; format the reply detail."""


def reply_detail(mission_id: str) -> str:
    return f"mission {mission_id} paused (progress kept; start_mission to resume)"
