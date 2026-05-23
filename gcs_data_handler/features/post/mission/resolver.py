"""mission resolver — replace the active mission's waypoints with the upload."""

from datetime import datetime, timezone

from router import Handler, Request, Response
from Utils.models import Bot, Mission, Waypoint

from .serializer import build_rows, extract_waypoints


class MissionHandler(Handler):
    method, path = "POST", "mission"

    def handle(self, req: Request, db) -> Response:
        waypoints = extract_waypoints(req.body)
        if waypoints is None:
            return Response(400, False, self.path, detail="mission must be a list")

        mission = db.query(Mission).first()
        if mission is None:
            mission = Mission(
                name=f"mission-{datetime.now(timezone.utc).isoformat(timespec='seconds')}",
                status="active",
                started_at=datetime.now(timezone.utc),
            )
            db.add(mission)
            db.flush()
        else:
            bot = db.query(Bot).first()
            mission.modified_at = datetime.now(timezone.utc)
            mission.status = "active"
            mission.ended_at = None
            # Fresh upload — clear prior reach-progress so the follower
            # starts from leg 1 instead of resuming.
            mission.waypoint_status = {}
            bot.mission = mission
            db.add(mission)
            db.commit()

        db.query(Waypoint).filter(Waypoint.mission_id == mission.id).delete(
            synchronize_session=False
        )

        rows = build_rows(mission.id, waypoints)
        for row in rows:
            db.add(row)

        db.commit()
        return Response(200, True, self.path, detail=f"{len(rows)} wp(s) -> mission {mission.id}")
