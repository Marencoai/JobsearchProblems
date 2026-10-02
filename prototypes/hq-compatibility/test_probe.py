import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from probe import ProbeServer, SCOPE


class ProbeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ProbeServer()
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.server.fixtures.clear()

    def request(self, msg=None, token=None, path="/mcp", extra=None):
        headers = {"Content-Type": "application/json", **(extra or {})}
        if token:
            headers["Authorization"] = "Bearer " + token
        req = Request(self.server.origin + path, data=json.dumps(msg).encode() if msg is not None else None, headers=headers)
        try:
            response = urlopen(req, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            return response.status, response.headers, json.loads(raw) if raw else None

    def call(self, token=None, arguments=None):
        return self.request({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {
            "name": "hq_compatibility_probe", "arguments": arguments if arguments is not None else {"test_nonce": "test-1"}}}, token)

    def test_initialize_and_notification(self):
        self.assertEqual(self.request({"jsonrpc": "2.0", "id": 1, "method": "initialize"})[2]["result"]["protocolVersion"], "2025-03-26")
        self.assertEqual(self.request({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}})[2]["result"]["protocolVersion"], "2025-06-18")
        self.assertEqual(self.request({"jsonrpc": "2.0", "method": "notifications/initialized"})[0], 202)

    def test_only_one_readonly_tool(self):
        tools = self.request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})[2]["result"]["tools"]
        self.assertEqual(len(tools), 1)
        self.assertTrue(tools[0]["annotations"]["readOnlyHint"])

    def test_challenge_and_metadata(self):
        status, headers, _ = self.call()
        self.assertEqual(status, 401)
        self.assertIn("resource_metadata=", headers["WWW-Authenticate"])
        metadata = self.request(path="/.well-known/oauth-protected-resource/mcp")[2]
        self.assertEqual(metadata["scopes_supported"], [SCOPE])
        self.assertEqual(self.request(path="/.well-known/oauth-authorization-server")[2]["code_challenge_methods_supported"], ["S256"])

    def test_success_has_no_auth_secret_or_runtime_claim(self):
        token = self.server.issue_fixture()
        status, _, body = self.call(token)
        self.assertEqual(status, 200)
        result = body["result"]["structuredContent"]
        self.assertEqual(result["test_nonce"], "test-1")
        self.assertFalse(result["production_access"])
        self.assertFalse(result["oauth_flow_proven"])
        self.assertFalse(result["scheduled_runtime_proven"])
        self.assertNotIn(token, json.dumps(body))

    def test_invalid_expired_audience_and_revoked_fixtures(self):
        tokens = ["unknown", self.server.issue_fixture(ttl=-1), self.server.issue_fixture(audience="invalid")]
        revoked = self.server.issue_fixture()
        del self.server.fixtures[revoked]
        for token in tokens + [revoked]:
            self.assertEqual(self.call(token)[0], 401)

    def test_scope_denial(self):
        self.assertEqual(self.call(self.server.issue_fixture(scope="wrong"))[0], 403)

    def test_input_does_not_accept_identity_or_url(self):
        token = self.server.issue_fixture()
        for arguments in [{"test_nonce": "ok", "principal_id": "owner"}, {"test_nonce": "https://example.com"}, {}, {"test_nonce": "a" * 65}]:
            self.assertEqual(self.call(token, arguments)[2]["error"]["code"], -32602)

    def test_unknown_method_and_origin(self):
        msg = {"jsonrpc": "2.0", "id": 2, "method": "execute_sql"}
        self.assertEqual(self.request(msg)[2]["error"]["code"], -32601)
        self.assertEqual(self.request(msg, extra={"Origin": "https://invalid.example"})[0], 403)

    def test_paths_and_no_sse(self):
        self.assertEqual(self.request(path="/mcp")[0], 405)
        self.assertEqual(self.request(path="/secrets")[0], 404)


if __name__ == "__main__":
    unittest.main()
