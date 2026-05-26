"""emergency_stop resolver — immediately halt the Bot.

CustomNav has no DB-level kill switch, so this halts the bot through the same
levers the follower already obeys:
  • mode = MANUAL    — AUTO mission-following and RTH only drive in AUTO, so
                       MANUAL drops cli.py into the _db_cmd branch (no follower).
  • input_speed/steer = 0 — the MANUAL branch sends these straight to the motors.
  • return_to_home = False — belt-and-suspenders; RTH never drives in MANUAL,
                       but clear it so it doesn't re-engage on the next AUTO.
  • status = "emergency_stop" — surfaced to the operator UI.

Idempotent and body-less: re-issuing it is harmless.
"""

from router import Handler, Request, Response
from Utils.models import Bot

from .serializer import ESTOP_STATUS, reply_detail


class EmergencyStopHandler(Handler):
    method, path = "POST", "emergency_stop"

    def handle(self, req: Request, db) -> Response:
        bot = db.query(Bot).first()
        if bot is None:
            return Response(404, False, self.path, detail="no Bot row")

        bot.mode = "MANUAL"
        bot.input_speed = 0
        bot.input_steer = 0
        bot.return_to_home = False
        bot.status = ESTOP_STATUS
        db.commit()

        return Response(200, True, self.path,
                        body={"status": ESTOP_STATUS, "mode": "MANUAL"},
                        detail=reply_detail())
