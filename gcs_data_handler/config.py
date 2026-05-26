"""
config.py — constants and logging setup for the GCS data handler.

The handler is a request/response server over UART: it does not push; it serves
telemetry (and accepts commands) only when the GCS asks. Tunables live here.
Raise verbosity with the LOG_LEVEL env var, e.g.

    LOG_LEVEL=DEBUG python gcs_data_handler.py
"""

import logging
import os

# ── Serial link ──────────────────────────────────────────────────────
BAUD_RATE = 460800

# ── Serve loop ───────────────────────────────────────────────────────
# How often the serve loop drains the UART for new requests. Smaller =
# lower response latency, slightly more idle CPU.
POLL_INTERVAL_S = 0.02
RECONNECT_DELAY_S = 2.0       # wait between serial reconnect attempts

# ── HTTP server (Flask) ──────────────────────────────────────────────
# Same routes as the UART server. Port 80 needs root / CAP_NET_BIND_SERVICE;
# override with HTTP_PORT (e.g. 8080) when running unprivileged.
HTTP_HOST = os.environ.get("HTTP_HOST", "0.0.0.0")
HTTP_PORT = int(os.environ.get("HTTP_PORT", "8080"))


def setup_logging() -> None:
    """Configure root logging once. Default INFO; LOG_LEVEL=DEBUG for tracing."""
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)-5s %(name)-13s | %(message)s",
        datefmt="%H:%M:%S",
    )
