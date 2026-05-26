"""
http_server.py — Flask HTTP front-end that shares the UART server's logic.

Every HTTP request is translated into the common request envelope and dispatched
through the same `Router.handle()` used by the UART transport, so both servers
expose identical behaviour from one set of handlers (router.py / telemetry.py).

    GET  /                 → service info + route list
    GET  /<path>          → e.g. /telemetry, /ping
    POST /<path>          → e.g. /drive, /mode, /status, /mission  (JSON body)

Responses are the same dicts the UART server returns, as JSON, with the HTTP
status code taken from the response's `status` field.
"""

import logging

from flask import Flask, jsonify, request

log = logging.getLogger("gcs.http")


def create_http_app(router, db_factory) -> Flask:
    app = Flask(__name__)

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({
            "ok": True,
            "status": 200,
            "service": "gcs_data_handler",
            "transports": ["uart", "http"],
            "routes": router.route_list(),
        })

    @app.route("/<route>", methods=["GET", "POST", "OPTIONS"])
    def dispatch(route):
        if request.method == "OPTIONS":          # CORS preflight
            return "", 204
        body = request.get_json(silent=True) if request.method == "POST" else {}
        msg = {"method": request.method, "path": route, "body": body or {}}
        resp = router.handle(msg)                 # ← shared core
        return jsonify(resp), int(resp.get("status", 200))

    @app.after_request
    def _cors(r):
        # LAN GCS bridge — allow the browser UI to call this from any origin.
        r.headers["Access-Control-Allow-Origin"] = "*"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return r

    @app.teardown_request
    def _cleanup(_exc):
        # Release this worker thread's scoped session back to the pool.
        db_factory.remove()

    return app
