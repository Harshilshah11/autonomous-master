"""get_home serializer — Bot home point + return-to-home flag."""

from datetime import datetime, timezone


def build_home(bot) -> dict:
    """Format the Bot's home_coordinates and return_to_home flag as the body."""
    home = None
    return_to_home = False
    if bot is not None:
        home = bot.home_coordinates or {}
        return_to_home = bool(bot.return_to_home)
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "bot_id": str(bot.id) if bot else None,
        "home_coordinates": home,
        "return_to_home": return_to_home,
    }
