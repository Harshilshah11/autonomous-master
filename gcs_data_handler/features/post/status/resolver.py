"""status resolver — set Bot.status."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import parse


class StatusHandler(Handler):
    method, path = "POST", "status"

    def handle(self, req: Request, db) -> Response:
        status = parse(req.body)
        if not status:
            return Response(400, False, self.path, detail="empty status")
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        bot.status = status
        db.commit()
        return Response(200, True, self.path, detail=status)
