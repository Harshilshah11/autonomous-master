"""start_mission resolver — (re)activate the Bot's assigned mission.

Auto-start is preserved: set_mission_ugv already marks a freshly-assigned
mission 'active'. start_mission is the operator's play/resume lever — it flips a
paused or aborted mission back to 'active' (CustomNav's follower drives only
while status == 'active'). Re-starting a completed mission also clears its
reach-progress so it re-runs from the first waypoint. Mode is left untouched
(it stays AUTO); emergency_stop is the only lever that drops to MANUAL.
"""

from datetime import datetime, timezone

from router import Handler, Request, Response
from Utils.models import Bot, Waypoint

from .serializer import reply_detail


class StartMissionHandler(Handler):
    method, path = "POST", "start_mission"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        mission = bot.mission
        if mission is None:
            return Response(400, False, self.path, detail="no mission assigned")

        was = mission.status
        mission.status = "active"
        mission.ended_at = None
        if mission.started_at is None:
            mission.started_at = datetime.now(timezone.utc)
        # Re-running a finished mission starts fresh from the first waypoint.
        if was == "completed":
            mission.waypoint_status = {}
            db.query(Waypoint).filter(Waypoint.mission_id == mission.id).update(
                {"reached_at": None}, synchronize_session=False)
        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id), "status": "active"},
                        detail=reply_detail(str(mission.id), was))
