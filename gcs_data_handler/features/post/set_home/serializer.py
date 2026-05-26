"""set_home serializer — parse the home coordinates body.

Stores home as {"lat": <float>, "lng": <float>} to match the Bot.home_coordinates
shape. Accepts lng/lon/long aliases for the longitude key.
"""


def parse(body: dict) -> dict:
    """Return {"lat": float, "lng": float}. Raises ValueError on bad input."""
    lat = body.get("lat")
    lng = body.get("lng", body.get("lon", body.get("long")))
    if lat is None or lng is None:
        raise ValueError("set_home requires lat and lng")
    try:
        return {"lat": float(lat), "lng": float(lng)}
    except (TypeError, ValueError):
        raise ValueError("lat and lng must be numbers")
