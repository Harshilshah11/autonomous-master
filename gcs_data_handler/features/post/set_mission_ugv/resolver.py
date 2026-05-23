"""set_mission_ugv resolver — assign an existing mission to the Bot.

Marks the mission active and clears any prior `ended_at`. Does NOT clear
per-leg reach progress (`waypoint_status`) — switching missions preserves
progress; use `edit_mission_waypoints` for a fresh upload.
"""

from datetime import datetime, timezone

from router import Handler, Request, Response
from Utils.models import Bot, Mission

from .serializer import parse_mission_id


class SetMissionUgvHandler(Handler):
    method, path = "POST", "set_mission_ugv"

    def handle(self, req: Request, db) -> Response:
        try:
            mission_id = parse_mission_id(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=f"bad mission_id: {e}")

        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")

        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission is None:
            return Response(404, False, self.path, detail=f"no mission {mission_id}")

        bot.mission = mission
        mission.status = "active"
        mission.ended_at = None
        if mission.started_at is None:
            mission.started_at = datetime.now(timezone.utc)
        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id)},
                        detail=f"bot {bot.id} -> mission {mission.id}")
