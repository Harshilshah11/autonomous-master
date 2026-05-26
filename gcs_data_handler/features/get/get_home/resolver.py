"""get_home resolver — current Bot home point + return-to-home flag."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import build_home


class GetHomeHandler(Handler):
    method, path = "GET", "get_home"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        return Response(200, True, self.path, body=build_home(bot))
