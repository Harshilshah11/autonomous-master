"""ugv_odometry serializer — Bot odometry/telemetry block (no mission)."""

from datetime import datetime, timezone


def build_odometry(bot) -> dict:
    """Format the current Bot row's odometry/telemetry fields as the body."""
    data = None
    if bot is not None:
        data = {
            "x": bot.x,
            "y": bot.y,
            "lat": bot.lat,
            "long": bot.long,
            "batv": bot.battery_volt,
            "uptime_ms": bot.uptime_ms,
            "yaw": bot.yaw,
            "vx": bot.vx,
            "gps_fix": bot.gps_fix,
            "sat": bot.satellites,
            "s_x": bot.sigma_x,
            "s_y": bot.sigma_y,
            "hz": bot.telemetry_rate_hz,
            "speed": bot.input_speed,
        }
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "bot_id": str(bot.id) if bot else None,
        "data": data,
    }
