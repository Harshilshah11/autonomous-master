"""ugv_odometry resolver — current Bot odometry snapshot."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import build_odometry


class UgvOdometryHandler(Handler):
    method, path = "GET", "ugv_odometry"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        return Response(200, True, self.path, body=build_odometry(bot))
