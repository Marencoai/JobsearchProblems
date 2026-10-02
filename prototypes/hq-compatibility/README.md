# Local HQ compatibility probe

Bounded test-only artifact; no database, credentials, external data, persistent storage, installed ChatGPT integration or outbound request. Synthetic consent is a local HTML page; all grants are in memory. Python standard library only.

Run the tests:

```sh
cd prototypes/hq-compatibility
python3 -m unittest -v test_probe.py test_oauth.py
```

Launch the loopback endpoint:

```sh
python3 probe.py --port 8769
```

It listens only on 127.0.0.1. Stop that owned foreground process with Ctrl-C. The CLI prints only the endpoint, never tokens. With no callback allowlist, registration/consent cannot complete; discovery remains available. The tests allow one synthetic callback and exercise the whole local flow without contacting it. No real user/account exists.

Implemented: JSON-only stateless MCP initialize/notification/tools/list/tools/call, one nonce/time/receipt probe, protected-resource and authorization-server metadata, DCR for public clients, authorization code + S256 PKCE, explicit synthetic consent/denial with one-use CSRF handle, exact redirect allowlist, exact scope/resource binding, 60-second code/consent expiry, 30-second opaque access tokens, rotating refresh tokens with a ten-minute absolute grant lifetime, replay family revocation, and access/refresh revocation. All auth artifacts remain in memory. No JWT signing/validation, real Auth mapping, database, external fetch, SSE or persistent session. The authorization endpoint cannot select a real principal.

**22 local HTTP tests passed** after final changes. Tests cover positive PKCE/bearer transport and negative/replay/expiry/refresh/revocation paths, attacker Host/Origin, denied callback/client/resource/scope, bounded input and metadata. Local listeners closed and fixture state discarded by teardown. Token expiry cases alter only synthetic in-memory deadlines rather than wait; they do not prove actual scheduled refresh. Initial sandbox binding was denied; approved loopback-only escalation ran successfully. Actual ChatGPT OAuth, discovery/call, scheduled runtime, refresh, and project Auth/RLS remain unproven.

Safe external-origin configuration is explicit and never derived from Host or forwarding headers. Only a bare HTTPS origin is accepted; callbacks are exact startup allowlist entries. After approval and an actual temporary hostname/observed callback exist, the launch shape is:

```sh
python3 probe.py --port 8769 --public-origin https://ACTUAL-HOST.trycloudflare.com --redirect-uri ACTUAL-OBSERVED-HTTPS-CALLBACK
```

Those uppercase values are placeholders, not a ready URL/callback. Do not invent a callback or use the synthetic test callback in ChatGPT. Do not relax the allowlist if DCR fails: inspect the authorized setup's actual callback and configure that exact URI. No secrets or OAuth client credentials belong in this command. Metadata advertises DCR and public-client auth method none; CIMD is not advertised or fetched. The selected ChatGPT form's OAuth default can attempt this documented path, but DCR interoperability still needs actual client evidence. Leave advanced credential fields empty unless the observed client requires a separately reviewed setup.

## Narrow temporary public-HTTPS candidate

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) documents temporary HTTPS forwarding without a Cloudflare account/domain. Proposed command, **not run**:

```sh
cloudflared tunnel --url http://127.0.0.1:8769
```

This would expose only this dummy process, including discovery metadata, through a generated trycloudflare.com hostname to anyone who knows the URL. Cloudflare terminates/proxies traffic; no private data or credentials may be included. The hostname changes on restart, has no uptime guarantee and stops working when the owned cloudflared process stops. No account or billed hosting resource is required by the documented flow; no price guarantee or cost approval beyond this test is inferred. Use an official downloaded cloudflared binary isolated to the prototype; it is currently absent. Never install/run it or publish the endpoint until the parent approves this exact exposure.

Quick Tunnels do not support SSE. This probe uses JSON responses, so it is a plausible discovery transport; actual ChatGPT JSON transport support through the tunnel must be tested. Do not add Cloudflare email gating: it requires an interactive browser and is incompatible with unattended machine requests.

The isolated synthetic authorization server is now implemented and tested locally. Its generated issuer/resource origins must use the actual temporary hostname; current loopback metadata cannot be treated as public OAuth metadata. No permanent hostname, real OAuth account, OpenAI/Supabase key or production token is required for the synthetic issuer, but client installation and test consent remain interactive access decisions.

## One consolidated setup requirement

Parent checks developer-mode availability. Request only: temporary dummy HTTPS exposure via the above account-free forwarding route, installation of HQ Compatibility Test into the intended ChatGPT Work chat, and explicit synthetic-only consent. No production identity or permission. The local synthetic issuer is ready; configure only the real approved test hostname and observed callback during setup. Then prove manual authenticated invocation before scheduling one isolated one-time probe; prove refresh in that actual runtime separately. Stop on unsupported installation/authentication instead of using admin SQL or introducing another scheduler.

Cleanup: stop only the two owned foreground processes; remove the test ChatGPT connection and isolated test tasks; clear synthetic issuer sessions; delete generated auth artifacts if any. Preserve sanitized receipts/test reports only. Production review remains contingent on actual scheduled compatibility proof.

