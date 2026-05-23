"""edit_mission_waypoints resolver — replace a mission's waypoints by id.

Clears the mission's per-leg reach progress (`waypoint_status`) because the
new waypoint list invalidates it; the follower starts from leg 1.
"""

from router import Handler, Request, Response
from Utils.models import Mission, Waypoint

from .serializer import build_rows, parse


class EditMissionWaypointsHandler(Handler):
    method, path = "POST", "edit_mission_waypoints"

    def handle(self, req: Request, db) -> Response:
        try:
            mission_id, waypoints = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=str(e))

        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission is None:
            return Response(404, False, self.path, detail=f"no mission {mission_id}")

        # Fresh waypoint list invalidates prior reach-progress.
        mission.waypoint_status = {}

        db.query(Waypoint).filter(Waypoint.mission_id == mission.id).delete(
            synchronize_session=False
        )
        rows = build_rows(mission.id, waypoints)
        for row in rows:
            db.add(row)

        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id), "waypoint_count": len(rows)},
                        detail=f"{len(rows)} wp(s) -> mission {mission.id}")
