"""set_mission_cruise_speed resolver — update a mission's max_cruise_speed by id.

Leaves the waypoints (and their reach-progress in `waypoint_status`) untouched —
this only changes the cruise cap. Bumps `modified_at` so the CustomNav follower,
which only re-reads the cruise cap when it reloads the mission, picks up the new
speed on the next tick.
"""

from datetime import datetime, timezone

from router import Handler, Request, Response
from Utils.models import Mission

from .serializer import parse


class SetMissionCruiseSpeedHandler(Handler):
    method, path = "POST", "set_mission_cruise_speed"

    def handle(self, req: Request, db) -> Response:
        try:
            mission_id, max_cruise_speed = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=str(e))

        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission is None:
            return Response(404, False, self.path, detail=f"no mission {mission_id}")

        mission.max_cruise_speed = max_cruise_speed
        # The follower only re-reads the cruise cap when it reloads the mission,
        # so bump modified_at to trigger that reload (mirrors edit_mission_waypoints).
        mission.modified_at = datetime.now(timezone.utc)
        db.commit()

        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id),
                              "max_cruise_speed": max_cruise_speed},
                        detail=f"max_cruise_speed={max_cruise_speed} m/s -> mission {mission.id}")
