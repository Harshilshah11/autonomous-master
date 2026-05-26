"""pause_mission resolver — hold the Bot's active mission, keeping progress.

Sets status='paused'; CustomNav's follower holds position (0,0) while a mission
is not 'active' but keeps its reach-progress, so start_mission resumes from
where it stopped. Stays in AUTO (mode untouched) — pause is distinct from
emergency_stop, which drops to MANUAL.
"""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import reply_detail


class PauseMissionHandler(Handler):
    method, path = "POST", "pause_mission"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        mission = bot.mission
        if mission is None:
            return Response(400, False, self.path, detail="no mission assigned")

        mission.status = "paused"
        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id), "status": "paused"},
                        detail=reply_detail(str(mission.id)))
