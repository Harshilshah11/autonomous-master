"""
device_ports.py — robust USB-serial device resolution by stable identity
========================================================================
Linux enumeration order (/dev/ttyUSB0, ttyUSB1, ttyACM0 …) is NOT stable
across reboots or replugs — the same physical device can land on a different
number. This module resolves each device by its USB *identity* instead
(serial number → product string → VID:PID), so the correct port is always
selected regardless of numbering.

Devices on SAIBYA (discovered 2026-05-23 via `python device_ports.py`):

    name              VID:PID     serial                            product
    ────────────────  ──────────  ────────────────────────────────  ──────────
    Arduino GIGA R1   2341:0266   002000353033510534323437          Giga
    LiDAR (CP2102N)   10C4:EA60   ea059860f40aee11b1b74b02f59e3369  CP2102N …
    GCS link (CP2102) 10C4:EA60   0001                              CP2102 …

The two CP210x adapters share a VID:PID, so they are told apart by serial
number (preferred) and by the "CP2102N" vs "CP2102 " product string.

Overrides (no code change needed):
  * an explicit path always wins — set the env var named in each DeviceSpec
    (ARDUINO_PORT / LIDAR_PORT / GCS_PORT), or pass a CLI flag where supported.
If you swap an adapter, run `python device_ports.py` to read the new identity
and update the matching DeviceSpec below.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable, List, Optional

from serial.tools import list_ports


class DeviceNotFound(Exception):
    pass


@dataclass(frozen=True)
class DeviceSpec:
    name: str
    vid: Optional[int] = None
    pid: Optional[int] = None
    serial_number: Optional[str] = None   # strongest discriminator
    product: Optional[str] = None         # case-insensitive substring
    env_var: Optional[str] = None         # explicit override path, if set

    def _vidpid_ok(self, p) -> bool:
        return ((self.vid is None or p.vid == self.vid) and
                (self.pid is None or p.pid == self.pid))

    # matchers, most-specific first
    def match_serial(self, p) -> bool:
        return (self.serial_number is not None and self._vidpid_ok(p)
                and (p.serial_number or "") == self.serial_number)

    def match_product(self, p) -> bool:
        return (self.product is not None and self._vidpid_ok(p)
                and self.product.lower() in (p.product or "").lower())

    def match_vidpid(self, p) -> bool:
        return (self.vid is not None and self._vidpid_ok(p))


# ── Known devices ────────────────────────────────────────────────────
ARDUINO = DeviceSpec(
    name="Arduino GIGA R1 (telemetry)",
    vid=0x2341, pid=0x0266,
    serial_number="002000353033510534323437",
    product="Giga",
    env_var="ARDUINO_PORT",
)
LIDAR = DeviceSpec(
    name="LiDAR (CP2102N)",
    vid=0x10C4, pid=0xEA60,
    serial_number="ea059860f40aee11b1b74b02f59e3369",
    product="CP2102N",
    env_var="LIDAR_PORT",
)
GCS_LINK = DeviceSpec(
    name="GCS link (CP2102)",
    vid=0x10C4, pid=0xEA60,
    serial_number="0001",
    product="CP2102 ",          # trailing space → not "CP2102N"
    env_var="GCS_PORT",
)

KNOWN = (ARDUINO, LIDAR, GCS_LINK)


def _print_ports(ports: List) -> None:
    if not ports:
        print("[PORT] no serial devices detected")
        return
    print("[PORT] devices present:")
    for p in ports:
        vidpid = f"{p.vid and hex(p.vid)}:{p.pid and hex(p.pid)}"
        print(f"[PORT]   {p.device:<14} {vidpid:<14} "
              f"serial={p.serial_number!r} product={p.product!r}")


def resolve_port(spec: DeviceSpec, *, required: bool = True,
                 retries: int = 10, retry_delay_s: float = 0.5) -> Optional[str]:
    """Resolve `spec` to a /dev path by USB identity.

    Order of preference (first level yielding exactly one device wins):
      0. explicit override     (spec.env_var environment variable)
      1. exact serial number   (+ VID:PID)
      2. product substring     (+ VID:PID)
      3. VID:PID alone
    USB can take a moment to enumerate after boot, so resolution is retried.
    Raises DeviceNotFound when required and nothing matches; returns None
    when not required.
    """
    if spec.env_var:
        override = os.environ.get(spec.env_var)
        if override:
            print(f"[PORT] {spec.name}: using {spec.env_var}={override}")
            return override

    levels: tuple[tuple[str, Callable], ...] = (
        ("serial", spec.match_serial),
        ("product", spec.match_product),
        ("vid:pid", spec.match_vidpid),
    )
    last_seen: List = []
    for attempt in range(retries + 1):
        last_seen = list(list_ports.comports())
        for level, matcher in levels:
            cands = [p for p in last_seen if matcher(p)]
            if len(cands) == 1:
                dev = cands[0].device
                print(f"[PORT] {spec.name}: {dev} via {level} "
                      f"(serial={cands[0].serial_number!r})")
                return dev
            if len(cands) > 1 and level == "serial":
                print(f"[PORT] WARN {spec.name}: {len(cands)} devices share "
                      f"serial {spec.serial_number!r}: {[c.device for c in cands]}")
        if attempt < retries:
            time.sleep(retry_delay_s)

    _print_ports(last_seen)
    if required:
        raise DeviceNotFound(
            f"{spec.name}: no matching USB serial device "
            f"(vid={spec.vid and hex(spec.vid)} pid={spec.pid and hex(spec.pid)} "
            f"serial={spec.serial_number!r}). Set {spec.env_var} to force a path, "
            f"or run `python device_ports.py` to see what is connected.")
    print(f"[PORT] {spec.name}: not found (optional) — skipping")
    return None


if __name__ == "__main__":
    print("=== USB serial devices present ===")
    _print_ports(list(list_ports.comports()))
    print("\n=== identity resolution ===")
    for s in KNOWN:
        try:
            resolve_port(s, required=False, retries=0)
        except DeviceNotFound as e:
            print(f"[PORT] {e}")
