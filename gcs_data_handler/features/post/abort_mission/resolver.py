"""abort_mission resolver — stop the Bot's mission and reset its progress.

Sets status='aborted' and clears reach-progress (Mission.waypoint_status + each
Waypoint.reached_at) so a later start_mission re-runs from the first waypoint.
The mission stays assigned to the Bot. Stays in AUTO (mode untouched);
CustomNav's follower holds position (0,0) while status != 'active'.
"""

from router import Handler, Request, Response
from Utils.models import Bot, Waypoint

from .serializer import reply_detail


class AbortMissionHandler(Handler):
    method, path = "POST", "abort_mission"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        mission = bot.mission
        if mission is None:
            return Response(400, False, self.path, detail="no mission assigned")

        mission.status = "aborted"
        mission.waypoint_status = {}
        wp_count = db.query(Waypoint).filter(
            Waypoint.mission_id == mission.id).update(
            {"reached_at": None}, synchronize_session=False)
        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id), "status": "aborted",
                              "waypoints_reset": wp_count},
                        detail=reply_detail(str(mission.id), wp_count))
