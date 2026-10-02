"""Loopback-only dummy MCP probe with synthetic OAuth; no outbound I/O."""
import argparse
import json
import re
import secrets
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import synthetic_oauth

SCOPE = "hq.compatibility.read"
TOOL = {
    "name": "hq_compatibility_probe",
    "description": "Test-only nonce/time echo. No production or external data access.",
    "inputSchema": {"type": "object", "properties": {"test_nonce": {
        "type": "string", "pattern": "^[A-Za-z0-9-]{1,64}$"}},
        "required": ["test_nonce"], "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "destructiveHint": False,
                    "idempotentHint": True, "openWorldHint": False},
    "securitySchemes": [{"type": "oauth2", "scopes": [SCOPE]}],
}


class ProbeServer(ThreadingHTTPServer):
    def __init__(self, address=("127.0.0.1", 0), origin=None, redirects=(), report_registration=False):
        configured = synthetic_oauth.public_origin(origin) if origin else None
        super().__init__(address, Handler)
        self.origin = configured or f"http://127.0.0.1:{self.server_port}"
        self.fixtures = {}
        self.report_registration = report_registration
        try:
            self.oauth = synthetic_oauth.OAuthState(self, redirects)
        except ValueError:
            self.server_close()
            raise

    def issue_fixture(self, ttl=30, scope=SCOPE, audience=None):
        # Test harness only; no HTTP token issuance and no printed/stored secrets.
        token = secrets.token_urlsafe(32)
        self.fixtures[token] = (time.monotonic() + ttl, scope,
                                audience or self.origin + "/mcp")
        return token


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log bearer headers, request bodies or fixture values.

    def reply(self, status, body=None, headers=None, html_body=False):
        raw = body.encode() if html_body else (json.dumps(body).encode() if body is not None else b"")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8" if html_body else "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if synthetic_oauth.get(self):
            return
        if self.path == "/.well-known/oauth-protected-resource/mcp":
            return self.reply(200, {"resource": self.server.origin + "/mcp",
                "authorization_servers": [self.server.origin],
                "scopes_supported": [SCOPE], "bearer_methods_supported": ["header"]})
        if self.path == "/mcp":
            return self.reply(405, {"error": "json_only_no_sse"}, {"Allow": "POST, DELETE"})
        self.reply(404, {"error": "not_found"})

    def do_DELETE(self):
        self.reply(405, {"error": "stateless_no_session"})

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin is not None and origin != self.server.origin:
            return self.reply(403, {"error": "origin_denied"})
        if synthetic_oauth.post(self):
            return
        if self.path != "/mcp":
            return self.reply(404, {"error": "not_found"})
        if self.headers.get_content_type() != "application/json":
            return self.reply(415, {"error": "json_required"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                return self.reply(413, {"error": "body_limit"})
            msg = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, {"error": "invalid_json"})
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
            return self.reply(400, {"error": "invalid_rpc"})
        method, ident = msg.get("method"), msg.get("id")
        params = msg.get("params", {})
        if not isinstance(params, dict):
            return self.rpc(ident, error={"code": -32602, "message": "Invalid params"})
        if method == "initialize":
            requested = params.get("protocolVersion", "2025-03-26")
            version = requested if requested in ("2025-03-26", "2025-06-18") else "2025-06-18"
            return self.rpc(ident, {"protocolVersion": version,
                "capabilities": {"tools": {}}, "serverInfo": {
                    "name": "hq-local-compatibility-probe", "version": "0.1.0"}})
        if method == "notifications/initialized":
            return self.reply(202)
        if method == "tools/list":
            return self.rpc(ident, {"tools": [TOOL]})
        if method != "tools/call":
            return self.rpc(ident, error={"code": -32601, "message": "Method not found"})
        authorization = self.headers.get("Authorization", "")
        fixture = self.server.fixtures.get(authorization[7:]) if authorization.startswith("Bearer ") else None
        if not fixture or fixture[0] <= time.monotonic() or fixture[2] != self.server.origin + "/mcp":
            return self.reply(401, {"error": "invalid_or_missing_test_fixture"}, {
                "WWW-Authenticate": 'Bearer resource_metadata="' + self.server.origin +
                '/.well-known/oauth-protected-resource/mcp", scope="' + SCOPE + '"'})
        if fixture[1] != SCOPE:
            return self.reply(403, {"error": "insufficient_scope"})
        args = params.get("arguments")
        if params.get("name") != TOOL["name"]:
            return self.rpc(ident, error={"code": -32602, "message": "Unknown tool"})
        if not isinstance(args, dict) or set(args) != {"test_nonce"} or not isinstance(args["test_nonce"], str) or not re.fullmatch(r"[A-Za-z0-9-]{1,64}", args["test_nonce"]):
            return self.rpc(ident, error={"code": -32602, "message": "Invalid nonce"})
        result = {"test_nonce": args["test_nonce"], "observed_at_utc": datetime.now(timezone.utc).isoformat(),
            "receipt": secrets.token_hex(16), "fixture": "dummy-plan", "local_fixture_verified": True,
            "production_access": False, "oauth_flow_proven": False, "scheduled_runtime_proven": False}
        self.rpc(ident, {"content": [{"type": "text", "text": json.dumps(result)}],
                         "structuredContent": result, "isError": False})

    def rpc(self, ident, result=None, error=None):
        self.reply(200, {"jsonrpc": "2.0", "id": ident,
                        **({"error": error} if error else {"result": result})})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8769)
    parser.add_argument("--public-origin", help="Explicit bare HTTPS origin; never taken from Host")
    parser.add_argument("--redirect-uri", action="append", default=[], help="Exact test client callback allowlist; repeat as needed")
    parser.add_argument("--report-registration", action="store_true", help="Report only observed query-free ChatGPT callback URIs; never codes/tokens")
    args = parser.parse_args()
    server = ProbeServer(("127.0.0.1", args.port), args.public_origin, args.redirect_uri, args.report_registration)
    print(f"Local dummy probe: {server.origin}/mcp; synthetic OAuth only; in-memory grants", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
