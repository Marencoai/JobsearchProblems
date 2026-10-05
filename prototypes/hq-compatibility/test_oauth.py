import base64
import hashlib
import json
import re
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit, parse_qs
from urllib.request import Request, build_opener, HTTPRedirectHandler
from probe import ProbeServer, SCOPE
from synthetic_oauth import public_origin


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


class OAuthTests(unittest.TestCase):
    def setUp(self):
        self.callback = "https://chatgpt.com/connector/oauth/synthetic-test"
        self.server = ProbeServer(redirects=[self.callback])
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.opener = build_opener(NoRedirect)
        self.verifier = "v" * 64
        self.challenge = base64.urlsafe_b64encode(hashlib.sha256(self.verifier.encode()).digest()).rstrip(b"=").decode()
        self.client = self.request("/register", {"redirect_uris": [self.callback]}, json_body=True)[2]["client_id"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.server.fixtures.clear()
        self.server.oauth = None

    def request(self, path, body=None, json_body=False, headers=None):
        content_type = "application/json" if json_body else "application/x-www-form-urlencoded"
        raw = (json.dumps(body) if json_body else urlencode(body)).encode() if body is not None else None
        req = Request(self.server.origin + path, data=raw, headers={"Content-Type": content_type, **(headers or {})})
        try:
            response = self.opener.open(req, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read().decode()
            result = json.loads(raw) if raw and "application/json" in response.headers.get("Content-Type", "") else raw
            return response.status, response.headers, result

    def authorization(self, **overrides):
        p = {"client_id": self.client, "redirect_uri": self.callback, "response_type": "code",
             "scope": SCOPE, "resource": self.server.origin + "/mcp", "state": "public-test-state",
             "code_challenge": self.challenge, "code_challenge_method": "S256"}
        p.update(overrides)
        return self.request("/authorize?" + urlencode(p))

    def code(self):
        page = self.authorization()[2]
        consent = re.search(r'name="consent" value="([A-Za-z0-9_-]+)"', page).group(1)
        result = self.request("/consent", {"consent": consent, "decision": "approve"})
        self.assertEqual(result[0], 303)
        values = parse_qs(urlsplit(result[1]["Location"]).query)
        self.assertEqual(values["state"], ["public-test-state"])
        return values["code"][0]

    def exchange(self, code, **overrides):
        p = {"grant_type": "authorization_code", "client_id": self.client, "code": code,
             "redirect_uri": self.callback, "code_verifier": self.verifier,
             "resource": self.server.origin + "/mcp"}
        p.update(overrides)
        return self.request("/token", p)

    def refresh(self, token, **overrides):
        p = {"grant_type": "refresh_token", "client_id": self.client, "refresh_token": token,
             "resource": self.server.origin + "/mcp"}
        p.update(overrides)
        return self.request("/token", p)

    def probe(self, token):
        return self.request("/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
            "params": {"name": "hq_compatibility_probe", "arguments": {"test_nonce": "oauth-local-1"}}},
            json_body=True, headers={"Authorization": "Bearer " + token})

    def test_metadata_and_host_not_trusted(self):
        _, _, metadata = self.request("/.well-known/oauth-authorization-server", headers={"Host": "attacker.invalid"})
        self.assertEqual(metadata["issuer"], self.server.origin)
        self.assertEqual(metadata["token_endpoint_auth_methods_supported"], ["none"])

    def test_full_pkce_bearer_success(self):
        status, _, tokens = self.exchange(self.code())
        self.assertEqual(status, 200)
        result = self.probe(tokens["access_token"])[2]["result"]["structuredContent"]
        self.assertTrue(result["local_fixture_verified"])
        self.assertNotIn(tokens["access_token"], json.dumps(result))
        self.assertFalse(result["scheduled_runtime_proven"])

    def test_code_replay_denied(self):
        code = self.code()
        self.assertEqual(self.exchange(code)[0], 200)
        self.assertEqual(self.exchange(code)[0], 400)

    def test_wrong_pkce_redirect_client_resource_scope(self):
        code = self.code()
        for bad in [{"code_verifier": "x" * 64}, {"redirect_uri": "https://attacker.invalid/callback"},
                    {"client_id": "unknown"}, {"resource": "https://invalid/mcp"}, {"scope": "admin"}]:
            self.assertEqual(self.exchange(code, **bad)[0], 400)
        self.assertEqual(self.exchange(code)[0], 200)

    def test_authorization_denies_plain_and_foreign_inputs(self):
        for bad in [{"code_challenge_method": "plain"}, {"scope": "admin"},
                    {"resource": "https://invalid/mcp"}, {"redirect_uri": "https://invalid/callback"},
                    {"client_id": "unknown"}, {"state": ""}, {"code_challenge": "bad"}]:
            self.assertEqual(self.authorization(**bad)[0], 400)

    def test_registration_allowlist_and_public_client_only(self):
        for body in [{"redirect_uris": ["https://attacker.invalid/callback"]},
                     {"redirect_uris": [self.callback], "token_endpoint_auth_method": "client_secret_basic"},
                     {"redirect_uris": [self.callback], "grant_types": ["password"]}]:
            self.assertEqual(self.request("/register", body, json_body=True)[0], 400)

    def test_consent_denial_csrf_and_replay(self):
        page = self.authorization()[2]
        consent = re.search(r'name="consent" value="([A-Za-z0-9_-]+)"', page).group(1)
        denied = self.request("/consent", {"consent": consent, "decision": "deny"})
        self.assertEqual(parse_qs(urlsplit(denied[1]["Location"]).query)["error"], ["access_denied"])
        self.assertEqual(self.request("/consent", {"consent": consent, "decision": "approve"})[0], 400)
        self.assertEqual(self.request("/consent", {"consent": "forged", "decision": "approve"})[0], 400)
        self.assertFalse(self.server.oauth.codes)

    def test_expired_code_and_consent(self):
        code = self.code()
        record = self.server.oauth.codes[code]
        self.server.oauth.codes[code] = (time.monotonic() - 1, record[1])
        self.assertEqual(self.exchange(code)[0], 400)
        page = self.authorization()[2]
        consent = re.search(r'name="consent" value="([A-Za-z0-9_-]+)"', page).group(1)
        record = self.server.oauth.pending[consent]
        self.server.oauth.pending[consent] = (time.monotonic() - 1, record[1])
        self.assertEqual(self.request("/consent", {"consent": consent, "decision": "approve"})[0], 400)

    def test_expired_access_then_refresh_rotation_and_replay(self):
        first = self.exchange(self.code())[2]
        access = first["access_token"]
        record = self.server.fixtures[access]
        self.server.fixtures[access] = (time.monotonic() - 1, record[1], record[2])
        self.assertEqual(self.probe(access)[0], 401)
        status, _, second = self.refresh(first["refresh_token"])
        self.assertEqual(status, 200)
        self.assertEqual(self.probe(second["access_token"])[0], 200)
        self.assertNotEqual(first["refresh_token"], second["refresh_token"])
        self.assertEqual(self.refresh(first["refresh_token"])[0], 400)
        self.assertEqual(self.probe(second["access_token"])[0], 401)
        self.assertEqual(self.refresh(second["refresh_token"])[0], 400)

    def test_refresh_client_resource_scope_and_absolute_expiry(self):
        first = self.exchange(self.code())[2]
        other = self.request("/register", {"redirect_uris": [self.callback]}, json_body=True)[2]["client_id"]
        for bad in [{"client_id": other}, {"resource": "https://invalid/mcp"}, {"scope": "admin"}]:
            self.assertEqual(self.refresh(first["refresh_token"], **bad)[0], 400)
        family = self.server.oauth.refresh[first["refresh_token"]]
        self.server.oauth.families[family]["expires"] = time.monotonic() - 1
        self.assertEqual(self.refresh(first["refresh_token"])[0], 400)
        self.assertEqual(self.probe(first["access_token"])[0], 401)

    def test_revoke_access_or_refresh_invalidates_family(self):
        for key in ["access_token", "refresh_token"]:
            tokens = self.exchange(self.code())[2]
            self.assertEqual(self.request("/revoke", {"token": tokens[key], "client_id": self.client})[0], 200)
            self.assertEqual(self.probe(tokens["access_token"])[0], 401)
            self.assertEqual(self.refresh(tokens["refresh_token"])[0], 400)

    def test_duplicate_parameters_and_origin_rejected(self):
        self.assertEqual(self.request("/authorize?client_id=a&client_id=b")[0], 400)
        self.assertEqual(self.request("/consent", {"consent": "x", "decision": "approve"}, headers={"Origin": "https://invalid"})[0], 403)
        self.assertEqual(self.request("/consent", {"consent": "x", "decision": "approve"}, headers={"Origin": "null"})[0], 403)

    def test_same_origin_consent_keeps_one_use_csrf(self):
        status, headers, page = self.authorization()
        self.assertEqual(headers['Referrer-Policy'], 'same-origin')
        self.assertEqual(headers['Content-Security-Policy'], "default-src 'none'; form-action 'self' " + self.callback + "; frame-ancestors 'none'")
        consent = re.search(r'name="consent" value="([A-Za-z0-9_-]+)"', page).group(1)
        self.assertEqual(self.request('/consent', {'consent':consent,'decision':'approve'}, headers={'Origin':self.server.origin})[0],303)
        self.assertEqual(self.request('/consent', {'consent':consent,'decision':'approve'}, headers={'Origin':self.server.origin})[0],400)

    def test_callback_cannot_inject_csp(self):
        from synthetic_oauth import OAuthState
        for uri in ['https://example.com/cb; form-action *', 'https://example.com/cb\"', "https://example.com/cb'"]:
            with self.assertRaises(ValueError):
                OAuthState(self.server,[uri])

    def test_safe_public_origin_configuration(self):
        self.assertEqual(public_origin("https://TEST.example/"), "https://test.example")
        for origin in ["http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#x", "https://example.com:1234"]:
            with self.assertRaises(ValueError):
                public_origin(origin)


if __name__ == "__main__":
    unittest.main()
