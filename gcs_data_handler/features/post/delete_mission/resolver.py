"""delete_mission resolver — delete a mission by id.

Waypoints go with it via the `Mission.waypoints` cascade ("all, delete-orphan").
If the mission is the Bot's currently-assigned one, the assignment is cleared
first (the FK is ON DELETE SET NULL, but clearing it explicitly keeps the loaded
ORM state consistent and lets us report it). The deleted mission's
`waypoint_status` is part of the row and is dropped with it.
"""

from router import Handler, Request, Response
from Utils.models import Bot, Mission

from .serializer import parse_mission_id


class DeleteMissionHandler(Handler):
    method, path = "POST", "delete_mission"

    def handle(self, req: Request, db) -> Response:
        try:
            mission_id = parse_mission_id(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=f"bad mission_id: {e}")

        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission is None:
            return Response(404, False, self.path, detail=f"no mission {mission_id}")

        # If this is the bot's active mission, drop the assignment first.
        was_active = False
        bot = db.query(Bot).filter(Bot.mission_id == mission.id).first()
        if bot is not None:
            bot.mission = None
            was_active = True

        wp_count = len(mission.waypoints)
        db.delete(mission)
        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission_id),
                              "waypoint_count": wp_count,
                              "was_active": was_active},
                        detail=f"deleted mission {mission_id} ({wp_count} wp(s)"
                               f"{', was active' if was_active else ''})")
