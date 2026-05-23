"""mode resolver — set Bot.mode."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import parse


class ModeHandler(Handler):
    method, path = "POST", "mode"

    def handle(self, req: Request, db) -> Response:
        mode = parse(req.body)
        if not mode:
            return Response(400, False, self.path, detail="empty mode")
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        bot.mode = mode
        db.commit()
        return Response(200, True, self.path, detail=mode)
