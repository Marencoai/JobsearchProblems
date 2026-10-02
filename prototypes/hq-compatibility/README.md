# Local HQ compatibility probe

Bounded test-only artifact; no database, credentials, external data, persistent storage, browser integration or outbound request. Python standard library only.

Run the tests:

```sh
cd prototypes/hq-compatibility
python3 -m unittest -v test_probe.py
```

Launch the loopback endpoint:

```sh
python3 probe.py --port 8769
```

It listens only on 127.0.0.1. Stop that owned foreground process with Ctrl-C. The CLI issues no token, so tool calls receive an authentication challenge. The tests generate 30-second opaque synthetic fixtures internally and exercise real loopback HTTP requests; fixtures never leave memory or enter output. Fixture expiry/scope/audience checks model rejection behavior, **not** JWT validation or actual OAuth authorization/refresh.

Implemented: JSON-only stateless MCP-style initialize, initialized notification, tools/list, and one tools/call; nonce/time/receipt echo; protected-resource metadata and WWW-Authenticate challenge; denial of unknown methods/paths, foreign browser Origin, oversized/invalid inputs and missing/invalid/expired/revoked/wrong-audience/wrong-scope fixtures. No SSE/session support. The synthetic issuer metadata URL deliberately returns 501: a genuine synthetic OAuth flow is still unimplemented and cannot be advertised as working.

Result: **9 tests passed**, actual loopback HTTP. Initial sandbox bind was denied; approved loopback-only escalation ran successfully. Server and test fixture memory were cleaned up by test teardown. No listener remains from these tests. No ChatGPT connection, scheduled call or refresh was tested.

## Narrow temporary public-HTTPS candidate

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) documents temporary HTTPS forwarding without a Cloudflare account/domain. Proposed command, **not run**:

```sh
cloudflared tunnel --url http://127.0.0.1:8769
```

This would expose only this dummy process, including discovery metadata, through a generated trycloudflare.com hostname to anyone who knows the URL. Cloudflare terminates/proxies traffic; no private data or credentials may be included. The hostname changes on restart, has no uptime guarantee and stops working when the owned cloudflared process stops. No account or billed hosting resource is required by the documented flow; no price guarantee or cost approval beyond this test is inferred. Use an official downloaded cloudflared binary isolated to the prototype; it is currently absent. Never install/run it or publish the endpoint until the parent approves this exact exposure.

Quick Tunnels do not support SSE. This probe uses JSON responses, so it is a plausible discovery transport; actual ChatGPT JSON transport support through the tunnel must be tested. Do not add Cloudflare email gating: it requires an interactive browser and is incompatible with unattended machine requests.

For authentication testing, an isolated reachable synthetic authorization server with PKCE/resource binding would need to be added after setup review. Its generated issuer/resource origins must use the actual temporary hostname; current loopback metadata cannot be treated as public OAuth metadata. No permanent hostname, real OAuth account, OpenAI/Supabase key or production token is required for the synthetic issuer, but client installation and test consent remain interactive access decisions.

## One consolidated setup requirement

Parent checks developer-mode availability. Request only: temporary dummy HTTPS exposure via the above account-free forwarding route, installation of HQ Compatibility Test into the intended ChatGPT Work chat, and explicit synthetic-only consent. No production identity or permission. Implement/test the minimal synthetic issuer only after this setup route is accepted. Then prove manual authenticated invocation before scheduling one isolated one-time probe; prove refresh in that actual runtime separately. Stop on unsupported installation/authentication instead of using admin SQL or introducing another scheduler.

Cleanup: stop only the two owned foreground processes; remove the test ChatGPT connection and isolated test tasks; clear synthetic issuer sessions; delete generated auth artifacts if any. Preserve sanitized receipts/test reports only. Production review remains contingent on actual scheduled compatibility proof.

