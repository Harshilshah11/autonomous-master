"""create_new_mission resolver — create a Mission row and optional waypoints.

The new mission starts in `status="planned"` and is NOT auto-assigned to the
Bot — call `set_mission_ugv` afterwards to activate it for the UGV.
"""

from router import Handler, Request, Response
from Utils.models import Mission

# Reuse the waypoint-row builder from the legacy POST /mission feature.
from features.post.mission.serializer import build_rows

from .serializer import parse


class CreateNewMissionHandler(Handler):
    method, path = "POST", "create_new_mission"

    def handle(self, req: Request, db) -> Response:
        spec = parse(req.body)

        mission = Mission(
            name=spec.name,
            description=spec.description,
            status="planned",
        )
        db.add(mission)
        db.flush()                          # populate mission.id for waypoint FKs

        rows = build_rows(mission.id, spec.waypoints)
        for row in rows:
            db.add(row)

        db.commit()
        return Response(200, True, self.path,
                        body={"mission_id": str(mission.id),
                              "name": mission.name,
                              "waypoint_count": len(rows)},
                        detail=f"mission {mission.id} ({len(rows)} wp(s))")
