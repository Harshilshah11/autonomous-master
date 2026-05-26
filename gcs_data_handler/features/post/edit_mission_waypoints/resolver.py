"""edit_mission_waypoints resolver — replace a mission's waypoints by id.

Clears the mission's per-leg reach progress (`waypoint_status`) because the
new waypoint list invalidates it; the follower starts from leg 1.
"""

from datetime import datetime, timezone

from router import Handler, Request, Response
from Utils.models import Mission, Waypoint

from .serializer import build_rows, parse


class EditMissionWaypointsHandler(Handler):
    method, path = "POST", "edit_mission_waypoints"

    def handle(self, req: Request, db) -> Response:
        try:
            mission_id, waypoints, max_cruise_speed = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=str(e))

        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission is None:
            return Response(404, False, self.path, detail=f"no mission {mission_id}")

        if max_cruise_speed is not None:
            mission.max_cruise_speed = max_cruise_speed

        # Fresh waypoint list invalidates prior reach-progress.
        mission.waypoint_status = {}

        # Waypoints live in a separate table, so replacing them never touches
        # the Mission row — and the `onupdate` on `modified_at` only fires when
        # the row itself is UPDATEd. Bump it explicitly so the CustomNav follower
        # (which reloads its route when `mission.modified_at` advances) actually
        # picks up the edited waypoints.
        mission.modified_at = datetime.now(timezone.utc)

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
