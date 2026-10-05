"""Closed-world synthetic OAuth. In-memory dummy subject; never production auth."""
import base64
import hashlib
import html
import json
import re
import secrets
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit

SCOPE = "hq.compatibility.read"


def public_origin(value):
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
            parsed.password or parsed.path not in ("", "/") or parsed.query or
            parsed.fragment or parsed.port not in (None, 443) or
            not re.fullmatch(r"[A-Za-z0-9.-]+", parsed.hostname)):
        raise ValueError("Public origin must be a bare HTTPS origin")
    return "https://" + parsed.hostname.lower()


def pairs(raw):
    values = parse_qs(raw, keep_blank_values=True, strict_parsing=True)
    if any(len(v) != 1 for v in values.values()):
        raise ValueError("Duplicate parameters")
    return {k: v[0] for k, v in values.items()}


class OAuthState:
    def __init__(self, server, redirects):
        self.server = server
        self.redirects = set(redirects)
        for uri in self.redirects:
            parsed = urlsplit(uri)
            local = parsed.scheme == "http" and parsed.hostname == "127.0.0.1"
            if (not (local or parsed.scheme == "https") or not parsed.hostname or
                    parsed.username or parsed.password or parsed.fragment):
                raise ValueError("Redirect must be exact HTTPS or loopback URL")
        self.clients, self.pending, self.codes = {}, {}, {}
        self.refresh, self.families, self.used_refresh = {}, {}, {}
        self.lock = threading.RLock()
        self.access_ttl, self.grant_ttl = 30, 600

    def metadata(self):
        origin = self.server.origin
        return {"issuer": origin, "authorization_endpoint": origin + "/authorize",
            "token_endpoint": origin + "/token", "registration_endpoint": origin + "/register",
            "revocation_endpoint": origin + "/revoke", "scopes_supported": [SCOPE],
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_methods_supported": ["none"],
            "code_challenge_methods_supported": ["S256"]}

    def bounded(self):
        # This short-running prototype rejects growth rather than silently persisting.
        return sum(map(len, (self.clients, self.pending, self.codes, self.refresh,
                             self.families, self.used_refresh))) < 256

    def register(self, body):
        redirects = body.get("redirect_uris")
        if self.server.report_registration and isinstance(redirects, list):
            def safe_list(value, allowed):
                return [x if x in allowed else "unsupported" for x in value[:4]] if isinstance(value, list) else "omitted_or_invalid"
            print(json.dumps({"event": "synthetic_registration_contract",
                              "grant_types": safe_list(body.get("grant_types"), {"authorization_code", "refresh_token"}),
                              "response_types": safe_list(body.get("response_types"), {"code"}),
                              "token_endpoint_auth_method": body.get("token_endpoint_auth_method") if body.get("token_endpoint_auth_method") in (None, "none", "client_secret_basic", "client_secret_post", "private_key_jwt") else "unsupported"}), flush=True)
            for uri in redirects:
                if isinstance(uri, str) and len(uri) <= 512:
                    parsed = urlsplit(uri)
                    if (parsed.scheme == "https" and parsed.hostname == "chatgpt.com" and
                            not parsed.username and not parsed.password and not parsed.query and
                            not parsed.fragment and parsed.port in (None, 443)):
                        print(json.dumps({"event": "observed_chatgpt_registration_callback",
                                          "redirect_uri": uri, "allowlisted": uri in self.redirects}), flush=True)
        if (not isinstance(redirects, list) or not redirects or
                any(not isinstance(u, str) or u not in self.redirects for u in redirects) or
                body.get("token_endpoint_auth_method", "none") != "none" or
                body.get("response_types", ["code"]) != ["code"] or
                set(body.get("grant_types", ["authorization_code", "refresh_token"])) !=
                {"authorization_code", "refresh_token"}):
            raise ValueError("invalid_client_metadata")
        client = secrets.token_urlsafe(24)
        self.clients[client] = set(redirects)
        return {"client_id": client, "redirect_uris": redirects,
                "token_endpoint_auth_method": "none", "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"]}

    def authorize(self, p):
        if (p.get("client_id") not in self.clients or
                p.get("redirect_uri") not in self.clients[p["client_id"]] or
                p.get("response_type") != "code" or p.get("scope") != SCOPE or
                p.get("resource") != self.server.origin + "/mcp" or
                p.get("code_challenge_method") != "S256" or
                not re.fullmatch(r"[A-Za-z0-9_-]{43}", p.get("code_challenge", "")) or
                not 1 <= len(p.get("state", "")) <= 256):
            raise ValueError("invalid_authorization_request")
        consent = secrets.token_urlsafe(32)
        self.pending[consent] = (time.monotonic() + 60, p)
        return ('<!doctype html><meta charset="utf-8"><title>HQ synthetic test consent</title>'
                '<h1>HQ Compatibility Test</h1><p>This grants a dummy subject access only to a '
                'nonce/time echo. No real account, database, production data or identity. '
                'Access lasts 30 seconds; refresh session lasts at most 10 minutes.</p>'
                '<p>Scope: hq.compatibility.read. Stop this local process to revoke all sessions.</p>'
                '<form method="post" action="' + html.escape(self.server.origin + '/consent', quote=True) + '">'
                '<input type="hidden" name="consent" value="' + consent + '">'
                '<button name="decision" value="approve">Approve synthetic test only</button>'
                '<button name="decision" value="deny">Deny</button></form>')

    def consent(self, p):
        pending = self.pending.pop(p.get("consent"), None)
        if not pending or pending[0] <= time.monotonic() or p.get("decision") not in ("approve", "deny"):
            raise ValueError("invalid_consent")
        request = pending[1]
        result = {"state": request["state"]}
        if p["decision"] == "deny":
            result["error"] = "access_denied"
        else:
            code = secrets.token_urlsafe(32)
            self.codes[code] = (time.monotonic() + 60, request)
            result["code"] = code
        return request["redirect_uri"] + ("&" if "?" in request["redirect_uri"] else "?") + urlencode(result)

    def issue(self, client, family=None):
        if family is None:
            family = secrets.token_urlsafe(24)
            self.families[family] = {"expires": time.monotonic() + self.grant_ttl,
                                    "client": client, "access": set(), "refresh": set()}
        grant = self.families[family]
        remaining = min(self.access_ttl, grant["expires"] - time.monotonic())
        token = self.server.issue_fixture(ttl=remaining)
        refresh = secrets.token_urlsafe(32)
        grant["access"].add(token)
        grant["refresh"].add(refresh)
        self.refresh[refresh] = family
        return {"access_token": token, "token_type": "Bearer", "expires_in": max(0, int(remaining)),
                "refresh_token": refresh, "scope": SCOPE}

    def revoke_family(self, family):
        grant = self.families.pop(family, None)
        if grant:
            for access in grant["access"]:
                self.server.fixtures.pop(access, None)
            for refresh in grant["refresh"]:
                self.refresh.pop(refresh, None)
            self.used_refresh = {key: value for key, value in self.used_refresh.items() if value != family}

    def token(self, p):
        client = p.get("client_id")
        if (client not in self.clients or p.get("resource") != self.server.origin + "/mcp" or
                p.get("scope", SCOPE) != SCOPE):
            raise ValueError("invalid_request")
        if p.get("grant_type") == "authorization_code":
            code = p.get("code")
            saved = self.codes.get(code)
            verifier = p.get("code_verifier", "")
            if not saved or saved[0] <= time.monotonic() or not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier):
                raise ValueError("invalid_grant")
            req = saved[1]
            digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
            if (req["client_id"] != client or req["redirect_uri"] != p.get("redirect_uri") or
                    not secrets.compare_digest(req["code_challenge"], digest)):
                raise ValueError("invalid_grant")
            del self.codes[code]
            return self.issue(client)
        if p.get("grant_type") == "refresh_token":
            refresh = p.get("refresh_token")
            family = self.refresh.get(refresh)
            if not family:
                previous = self.used_refresh.get(refresh)
                if previous and self.families.get(previous, {}).get("client") == client:
                    self.revoke_family(previous)
                raise ValueError("invalid_grant")
            grant = self.families[family]
            if grant["client"] != client:
                raise ValueError("invalid_grant")
            if grant["expires"] <= time.monotonic():
                self.revoke_family(family)
                raise ValueError("invalid_grant")
            del self.refresh[refresh]
            self.used_refresh[refresh] = family
            return self.issue(client, family)
        raise ValueError("unsupported_grant_type")

    def revoke(self, p):
        client = p.get("client_id")
        if client not in self.clients:
            raise ValueError("invalid_client")
        token = p.get("token")
        for family, grant in list(self.families.items()):
            if grant["client"] == client and (token in grant["access"] or token in grant["refresh"]):
                self.revoke_family(family)
                break


def get(handler):
    url = urlsplit(handler.path)
    state = handler.server.oauth
    if url.path == "/.well-known/oauth-authorization-server" and not url.query:
        handler.reply(200, state.metadata())
    elif url.path == "/authorize":
        try:
            with state.lock:
                if not state.bounded():
                    return handler.reply(429, {"error": "test_capacity"})
                page = state.authorize(pairs(url.query))
            handler.reply(200, page, {"Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'", "Referrer-Policy": "same-origin"}, html_body=True)
        except ValueError:
            handler.reply(400, {"error": "invalid_authorization_request"})
    else:
        return False
    return True


def post(handler):
    if handler.path not in ("/register", "/consent", "/token", "/revoke"):
        return False
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if not 0 < length <= 8192:
            handler.reply(413, {"error": "body_limit"})
            return True
        content_type = handler.headers.get_content_type()
        expected = "application/json" if handler.path == "/register" else "application/x-www-form-urlencoded"
        if content_type != expected:
            handler.reply(415, {"error": "content_type"})
            return True
        raw = handler.rfile.read(length).decode()
        p = json.loads(raw) if expected == "application/json" else pairs(raw)
        if not isinstance(p, dict):
            raise ValueError("invalid_request")
        state = handler.server.oauth
        with state.lock:
            if not state.bounded() and handler.path != "/revoke":
                handler.reply(429, {"error": "test_capacity"})
            elif handler.path == "/register":
                handler.reply(201, state.register(p))
            elif handler.path == "/consent":
                handler.reply(303, None, {"Location": state.consent(p)})
            elif handler.path == "/token":
                result = state.token(p)
                if handler.server.report_registration:
                    print(json.dumps({"event": "synthetic_token_exchange_succeeded",
                                      "grant_type": p.get("grant_type")}), flush=True)
                handler.reply(200, result)
            else:
                state.revoke(p)
                handler.reply(200, {})
    except (ValueError, TypeError, UnicodeError):
        handler.reply(400, {"error": "invalid_request_or_grant"})
    return True
