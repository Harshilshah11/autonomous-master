"""set_return_to_home resolver — set Bot.return_to_home flag."""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import parse


class SetReturnToHomeHandler(Handler):
    method, path = "POST", "set_return_to_home"

    def handle(self, req: Request, db) -> Response:
        try:
            flag = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=str(e))

        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")

        bot.return_to_home = flag
        db.commit()
        return Response(200, True, self.path,
                        body={"return_to_home": flag},
                        detail=f"return_to_home={flag}")
