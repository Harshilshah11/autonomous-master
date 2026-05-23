"""mission_status resolver — current mission progress + waypoints."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import build_mission_status


class MissionStatusHandler(Handler):
    method, path = "GET", "mission_status"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        return Response(200, True, self.path, body=build_mission_status(bot))
