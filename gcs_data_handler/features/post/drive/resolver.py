"""drive resolver — write input_speed / input_steer onto the Bot row."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import parse, reply_detail


class DriveHandler(Handler):
    method, path = "POST", "drive"

    def handle(self, req: Request, db) -> Response:
        try:
            cmd = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=f"bad values: {e}")
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")
        bot.input_speed = cmd.speed
        bot.input_steer = cmd.direction
        db.commit()
        return Response(200, True, self.path, detail=reply_detail(cmd))
