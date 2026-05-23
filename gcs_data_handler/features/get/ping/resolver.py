"""ping resolver — liveness check."""

from router import Handler, Request, Response

from .serializer import PONG


class PingHandler(Handler):
    method, path = "GET", "ping"

    def handle(self, req: Request, db) -> Response:
        return Response(200, True, self.path, detail=PONG)
