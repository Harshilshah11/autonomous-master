"""
app.py — the GCS data handler service: one core, two transports.

`GCSDataHandler` serves the same request/response API over BOTH:
  * UART  — drained in the main-thread serve loop (transport.py)
  * HTTP  — a Flask server on port 80 in a daemon thread (http_server.py)

Both call the same `Router` (router.py) over a thread-safe scoped session, so
the functionality lives in exactly one place and is shared by both transports.

    GCS ──(uart line | http request)──►  Router.handle  ──► response
"""

import logging
import threading
import time

import serial
from sqlalchemy.orm import scoped_session

from config import HTTP_HOST, HTTP_PORT, POLL_INTERVAL_S, setup_logging
from router import Router
from transport import SerialTransport
from Utils.models import Session as SessionFactory

log = logging.getLogger("gcs.app")


class GCSDataHandler:
    def __init__(self, http_host: str = HTTP_HOST, http_port: int = HTTP_PORT,
                 enable_http: bool = True, enable_uart: bool = True):
        # One scoped (thread-local) session registry shared by every transport.
        self.db_factory = scoped_session(SessionFactory)
        self.router = Router(self.db_factory)   # shared core (features/ handlers)
        self.transport = SerialTransport()
        self.http_host = http_host
        self.http_port = http_port
        self.enable_http = enable_http
        self.enable_uart = enable_uart

    def run(self) -> None:
        setup_logging()
        log.info("GCS data handler starting (uart=%s, http=%s)",
                 self.enable_uart, self.enable_http)
        if self.enable_http:
            self._start_http()
        if self.enable_uart:
            self._run_uart()        # blocks until Ctrl-C
        else:
            self._block_until_interrupt()

    # ── HTTP transport (Flask, background thread) ────────────────────
    def _start_http(self) -> None:
        from http_server import create_http_app   # imported lazily so the UART
                                                   # side runs even without Flask
        flask_app = create_http_app(self.router, self.db_factory)

        def _serve():
            try:
                flask_app.run(host=self.http_host, port=self.http_port,
                              threaded=True, use_reloader=False, debug=False)
            except Exception as e:
                log.error("HTTP server stopped: %s", e)

        threading.Thread(target=_serve, name="http", daemon=True).start()
        log.info("HTTP server listening on %s:%d", self.http_host, self.http_port)

    # ── UART transport (main thread) ─────────────────────────────────
    def _run_uart(self) -> None:
        self.transport.connect()
        try:
            while True:
                self._serve_uart_once()
                time.sleep(POLL_INTERVAL_S)
        except KeyboardInterrupt:
            log.info("stopped")
        finally:
            self.transport.close()
            self.db_factory.remove()

    def _serve_uart_once(self) -> None:
        try:
            requests = list(self.transport.poll())
        except (serial.SerialException, OSError) as e:
            log.warning("uart read error: %s", e)
            self.transport.reconnect()
            return
        for msg in requests:
            response = self.router.handle(msg)       # ← shared core
            try:
                self.transport.send(response)
            except (serial.SerialException, OSError) as e:
                log.warning("uart send error: %s", e)
                self.transport.reconnect()
                return

    def _block_until_interrupt(self) -> None:
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            log.info("stopped")
        finally:
            self.db_factory.remove()
