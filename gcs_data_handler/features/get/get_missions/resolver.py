"""get_missions resolver — list every mission with its waypoint count."""

from router import Handler, Request, Response
from Utils.models import Bot, Mission

from .serializer import build_missions_list


class GetMissionsHandler(Handler):
    method, path = "GET", "get_missions"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        missions = db.query(Mission).order_by(Mission.created_at.desc()).all()
        return Response(200, True, self.path, body=build_missions_list(missions, bot))
