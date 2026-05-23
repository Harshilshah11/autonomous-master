"""device_status resolver — probe Jetson-visible devices; report their status."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import build_status


class DeviceStatusHandler(Handler):
    method, path = "GET", "device_status"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        return Response(200, True, self.path, body=build_status(bot))
