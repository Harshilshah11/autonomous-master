"""
transport.py — serial link to the GCS, resilient to unplug/replug.

`SerialTransport` wraps device-identity resolution (device_ports), connection,
auto-reconnect, inbound JSON line framing (`LineReader`), and JSON sending:

    tp = SerialTransport()
    tp.connect()                  # blocks until the device is present
    tp.send({...})                # raises serial.SerialException on a dead link
    for msg in tp.poll(): ...     # decoded inbound JSON objects
    tp.reconnect()                # close + connect again
"""

import json
import logging
import time
from datetime import datetime, timezone
from typing import Iterator, Optional

import serial

from config import BAUD_RATE, RECONNECT_DELAY_S
from device_ports import resolve_port, GCS_LINK

log = logging.getLogger("gcs.transport")


def _parse_line(raw: bytes) -> Optional[dict]:
    """Decode one inbound line into a dict (with an _rx_ts), or None if invalid."""
    line = raw.strip()
    if not line:
        return None
    try:
        obj = json.loads(line.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        log.warning("bad JSON (%s): %r", e, line[:80])
        return None
    if not isinstance(obj, dict):
        log.warning("non-object frame: %r", line[:80])
        return None
    obj["_rx_ts"] = datetime.now(timezone.utc).isoformat()
    return obj


class LineReader:
    """Drains complete newline-terminated JSON objects from a serial port."""

    def __init__(self, ser: serial.Serial, max_buffer: int = 64 * 1024):
        self.ser = ser
        self._buf = bytearray()
        self._max = max_buffer

    def drain(self) -> Iterator[dict]:
        waiting = getattr(self.ser, "in_waiting", 0)
        if waiting:
            self._buf.extend(self.ser.read(waiting))

        if len(self._buf) > self._max:
            nl = self._buf.rfind(b"\n")
            self._buf = self._buf[nl + 1:] if nl >= 0 else bytearray()

        while True:
            nl = self._buf.find(b"\n")
            if nl < 0:
                break
            raw, self._buf = self._buf[:nl], self._buf[nl + 1:]
            pkt = _parse_line(raw)
            if pkt is not None:
                yield pkt


class SerialTransport:
    """Identity-resolved, auto-reconnecting JSON-over-serial link."""

    def __init__(self, spec=GCS_LINK, baud: int = BAUD_RATE,
                 reconnect_delay_s: float = RECONNECT_DELAY_S):
        self.spec = spec
        self.baud = baud
        self.reconnect_delay_s = reconnect_delay_s
        self._ser: Optional[serial.Serial] = None
        self._reader: Optional[LineReader] = None

    @property
    def is_open(self) -> bool:
        return self._ser is not None and self._ser.is_open

    def connect(self) -> None:
        """Block until the device is resolved (by USB identity) and opened."""
        while True:
            try:
                dev = resolve_port(self.spec)
                self._ser = serial.Serial(dev, self.baud, timeout=1)
                self._reader = LineReader(self._ser)
                log.info("connected: %s @ %d baud", dev, self.baud)
                return
            except Exception as e:
                log.warning("connect failed: %s — retrying in %ss",
                            e, self.reconnect_delay_s)
                time.sleep(self.reconnect_delay_s)

    def reconnect(self) -> None:
        log.info("reconnecting serial link…")
        self.close()
        self.connect()

    def send(self, payload: dict) -> None:
        """Send one JSON line. Raises serial.SerialException if the link is dead."""
        if self._ser is None:
            raise serial.SerialException("transport not connected")
        self._ser.write((json.dumps(payload, default=str) + "\n").encode("utf-8"))
        self._ser.flush()

    def poll(self) -> Iterator[dict]:
        """Yield any complete inbound JSON objects available right now."""
        if self._reader is None:
            return iter(())
        return self._reader.drain()

    def close(self) -> None:
        try:
            if self._ser is not None and self._ser.is_open:
                self._ser.close()
                log.info("port closed")
        except Exception:
            pass
        self._ser = None
        self._reader = None
