"""start_mission serializer — no request params; format the reply detail.

start_mission takes no body: it (re)activates the Bot's currently-assigned
mission. Shaped as a function so the route follows the serializer/resolver
split used by every other feature.
"""


def reply_detail(mission_id: str, was_status: str) -> str:
    return f"mission {mission_id} started (was {was_status!r}) -> active"
