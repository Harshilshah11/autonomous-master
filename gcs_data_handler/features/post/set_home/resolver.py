"""set_home resolver — set Bot.home_coordinates (coordinates only).

The return-to-home flag is set separately via POST set_return_to_home.
"""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import parse


class SetHomeHandler(Handler):
    method, path = "POST", "set_home"

    def handle(self, req: Request, db) -> Response:
        try:
            home = parse(req.body)
        except (TypeError, ValueError) as e:
            return Response(400, False, self.path, detail=str(e))

        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")

        bot.home_coordinates = home
        db.commit()
        return Response(200, True, self.path,
                        body={"home_coordinates": home},
                        detail=f"home lat={home['lat']} lng={home['lng']}")
