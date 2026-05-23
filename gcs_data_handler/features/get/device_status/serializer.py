"""
device_status serializer — probe Jetson-visible devices, format the response.

Only devices the Jetson can directly observe are reported:
  * controller, lidar, gcs_link  — USB-serial presence via device_ports.DeviceSpec.
  * gps                          — derived from Bot.gps_fix / Bot.satellites in DB.
  * imu                          — derived from Bot.telemetry_rate_hz (the firmware
                                   is actively pushing IMU readings when the rate
                                   is non-zero); current yaw surfaced for info.

Camera is not reported until the firmware sends per-device health.
"""

from datetime import datetime, timezone
from typing import Optional

from serial.tools import list_ports

from device_ports import ARDUINO, GCS_LINK, LIDAR, DeviceSpec


def _probe(spec: DeviceSpec, ports) -> Optional[str]:
    """Quiet, no-retry version of resolve_port for status snapshots."""
    for matcher in (spec.match_serial, spec.match_product, spec.match_vidpid):
        cands = [p for p in ports if matcher(p)]
        if len(cands) == 1:
            return cands[0].device
    return None


def _usb_record(spec: DeviceSpec, ports) -> dict:
    path = _probe(spec, ports)
    return {
        "connected": path is not None,
        "port": path,
        "name": spec.name,
    }


def _gps_record(bot) -> dict:
    if bot is None:
        return {"connected": False, "fix": None, "satellites": 0, "reason": "no Bot row"}
    fix = (bot.gps_fix or "").strip()
    sats = int(bot.satellites or 0)
    return {
        "connected": bool(fix) and sats > 0,
        "fix": fix or None,
        "satellites": sats,
    }


def _imu_record(bot) -> dict:
    """IMU is behind the controller — inferred from active firmware telemetry."""
    if bot is None:
        return {"connected": False, "yaw": None, "reason": "no Bot row"}
    rate = float(bot.telemetry_rate_hz or 0.0)
    return {
        "connected": rate > 0.0,
        "yaw": bot.yaw,
        "telemetry_rate_hz": rate,
    }


def build_status(bot) -> dict:
    """Snapshot of every directly-observable device."""
    ports = list(list_ports.comports())
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "devices": {
            "controller": _usb_record(ARDUINO,  ports),
            "lidar":      _usb_record(LIDAR,    ports),
            "gcs_link":   _usb_record(GCS_LINK, ports),
            "gps":        _gps_record(bot),
            "imu":        _imu_record(bot),
        },
    }
