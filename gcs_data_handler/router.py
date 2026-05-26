"""
router.py — request/response routing core (HTTP-style) over UART or HTTP.

This module defines the dispatch primitives only:

  * `Request` — parses an inbound JSON message (envelope or back-compat
    shorthand) into a (method, path, body, id) tuple.
  * `Response` — the outbound payload (`status`, `ok`, `path`, `id`, body+detail).
  * `Handler` — abstract base; one subclass per (method, path) lives under
    `features/<name>/resolver.py`.
  * `Router` — maps (method, path) → Handler and runs one message through.

The actual route logic lives in `features/`. Each feature folder has a
`serializer.py` (request parsing + response shaping) and a `resolver.py`
(the `Handler` subclass). `features.default_handlers()` returns them all
in registration order.

Request forms accepted:
  {"method":"GET","path":"ugv_odometry","id":7}
  {"method":"POST","path":"drive","body":{"speed":10,"direction":-5},"id":8}
  {"get":"ugv_odometry"}                       # GET shorthand
  {"speed":10,"direction":-5}                  # drive shorthand
  {"botMode":"AUTO"}                           # mode shorthand
  {"armStatus":"ARMED"}                        # status shorthand
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, List, Optional

log = logging.getLogger("gcs.router")


@dataclass
class Request:
    method: str                       # "GET" / "POST"
    path: str                         # "telemetry", "drive", ...
    body: dict
    id: Optional[Any] = None          # correlation id echoed in the response
    rx_ts: Optional[str] = None

    @classmethod
    def from_message(cls, msg: dict) -> "Request":
        """Parse an inbound JSON object into a Request (envelope or shorthand)."""
        rid = msg.get("id")
        rx_ts = msg.get("_rx_ts")

        # explicit envelope
        if "method" in msg or "path" in msg:
            body = msg.get("body")
            return cls(
                method=str(msg.get("method", "GET")).upper(),
                path=str(msg.get("path", "")).lower(),
                body=body if isinstance(body, dict) else {"_": body} if body is not None else {},
                id=rid, rx_ts=rx_ts,
            )
        # GET shorthand: {"get": "telemetry"}
        if "get" in msg:
            return cls("GET", str(msg["get"]).lower(), {}, rid, rx_ts)
        # command shorthand (back-compat with the old uplink protocol)
        if "speed" in msg or "direction" in msg:
            return cls("POST", "drive", msg, rid, rx_ts)
        if "botMode" in msg:
            return cls("POST", "mode", msg, rid, rx_ts)
        if "armStatus" in msg:
            return cls("POST", "status", msg, rid, rx_ts)
        return cls("", "", msg, rid, rx_ts)   # unroutable


@dataclass
class Response:
    status: int = 200                 # HTTP-style status code
    ok: bool = True
    path: str = ""
    id: Optional[Any] = None
    body: Optional[dict] = None       # merged into the response at top level
    detail: str = ""

    def to_message(self) -> dict:
        out = dict(self.body) if isinstance(self.body, dict) else {}
        out["ok"] = self.ok
        out["status"] = self.status
        out["path"] = self.path
        if self.id is not None:
            out["id"] = self.id
        if self.detail:
            out["detail"] = self.detail
        return out


class Handler(ABC):
    """Serves one (method, path) route. Implementations live in features/."""
    method: str = "GET"
    path: str = "base"

    @abstractmethod
    def handle(self, req: Request, db) -> Response:
        ...


class Router:
    """Maps (method, path) → Handler and dispatches one message to a response."""

    def __init__(self, db_factory, handlers: Optional[List[Handler]] = None):
        # db_factory() returns a session for the *current thread* (scoped_session),
        # so the UART loop and the Flask worker threads each get their own and
        # never share a Session across threads.
        self.db_factory = db_factory
        if handlers is None:
            # Lazy import: features/*/resolver.py imports Handler from this
            # module, so we can't import features at module load time.
            from features import default_handlers
            handlers = default_handlers()
        self.routes = {(h.method, h.path): h for h in handlers}

    def handle(self, msg: dict) -> dict:
        """Route one inbound message and return the response message (a dict).

        Shared by both transports (the UART serve loop and the Flask server).
        Uses a per-thread session from db_factory, so concurrent HTTP and UART
        requests are isolated from each other.
        """
        db = self.db_factory()
        db.expire_all()                     # see the latest DB state each request
        req = Request.from_message(msg)
        handler = self.routes.get((req.method, req.path))
        if handler is None:
            resp = Response(404, False, req.path or "?", req.id,
                            detail=f"no route {req.method or '?'} {req.path or '?'}")
        else:
            try:
                resp = handler.handle(req, db)
            except Exception as e:
                db.rollback()
                resp = Response(500, False, req.path, detail=f"error: {e}")
        resp.id = req.id
        if not resp.path:
            resp.path = req.path
        log.log(
            logging.INFO if resp.ok else logging.WARNING,
            "%s %s -> %d%s",
            req.method or "?", req.path or "?", resp.status,
            f" ({resp.detail})" if resp.detail else "",
        )
        # Release the per-request transaction now (read-only GETs leave one open
        # otherwise), so we don't hold locks / sit "idle in transaction" between
        # requests. No-op after a handler that already committed. The response
        # body was fully materialised by the serializer above.
        db.rollback()
        return resp.to_message()

    def route_list(self) -> List[str]:
        """Human-readable list of registered routes (used by the HTTP index)."""
        return [f"{m} {p}" for (m, p) in self.routes]
