"""
Entry point for the GCS data handler service.

Serves the same request/response API over BOTH a UART link and HTTP (Flask):

    python gcs_data_handler.py                     # UART + HTTP on :80 (needs root)
    HTTP_PORT=8080 python gcs_data_handler.py      # unprivileged HTTP port
    python gcs_data_handler.py --no-http           # UART only
    python gcs_data_handler.py --no-uart           # HTTP only
    LOG_LEVEL=DEBUG python gcs_data_handler.py     # verbose per-request tracing

Architecture (see each module):
    app.py        — GCSDataHandler: wires the shared core to both transports
    transport.py  — SerialTransport: UART connect/reconnect/send/poll
    http_server.py— Flask front-end; delegates to the same Router
    router.py     — Router + routing primitives (the shared core)
    features/     — one resolver + serializer per route; default_handlers() registry
    config.py     — constants + logging
    device_ports.py — resolve USB devices by identity (not tty number)
"""

import argparse
import sys
from pathlib import Path

# Make sibling modules importable regardless of CWD.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import GCSDataHandler
from config import HTTP_HOST, HTTP_PORT


def main() -> None:
    ap = argparse.ArgumentParser(
        description="GCS data handler — request/response server over UART + HTTP",
    )
    ap.add_argument("--http-host", default=HTTP_HOST)
    ap.add_argument("--http-port", type=int, default=HTTP_PORT,
                    help="HTTP port (default 80; needs root). Or set HTTP_PORT.")
    ap.add_argument("--no-http", action="store_true", help="Disable the HTTP server.")
    ap.add_argument("--no-uart", action="store_true", help="Disable the UART server.")
    args = ap.parse_args()

    GCSDataHandler(
        http_host=args.http_host,
        http_port=args.http_port,
        enable_http=not args.no_http,
        enable_uart=not args.no_uart,
    ).run()


if __name__ == "__main__":
    main()
