# Credential-free scheduled tool prototype · setup checkpoint

## Outcome

Follow-up under the parent's explicit local implementation instruction: the [bounded loopback probe](../../prototypes/hq-compatibility/README.md) now exists and passes nine real local HTTP tests, including synthetic auth rejection cases. No actual OAuth issuer, external endpoint, ChatGPT installation, scheduled invocation or refresh exists. The initial setup-only checkpoint below remains historical; actual runtime compatibility is still unproven. The README specifies Cloudflare's account-free Quick Tunnel as a proposed, unexecuted temporary forwarding option for consolidated setup review.

Actual scheduled-runtime discovery/call and authentication have **not** been proven. The approved compatibility prototype reached the connection-setup prerequisite. No server, public deployment, test automation, OAuth grant, account, key or production connection was created. No production tool was used in this prototype investigation.

Inventory of exposed tools found existing app permission/dependency inspection, automation management and website hosting, but no custom MCP connection creation/installation or interactive browser control. Plugin search/suggest tools are also not exposed here. No existing HQ test MCP endpoint is installed. Local cloudflared/ngrok commands are unavailable. These observations concern this executor's available capabilities, not a conclusion that ChatGPT scheduled tasks reject custom integrations.

## Supported route and exact next step

The official [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) supports developer-mode MCP testing over a public HTTPS endpoint or Secure MCP Tunnel, followed by connection creation in ChatGPT Plugins and tool discovery. The [scheduled task guide](https://learn.chatgpt.com/docs/automations) supports connected plugins; selected-account/task compatibility still requires execution evidence.

The minimal next authorization/setup step is **one temporary developer-mode test connection named HQ Compatibility Test, available to the intended ChatGPT chat/task, exposing only the synthetic hq_compatibility_probe tool**. A user/workspace administrator must enable developer mode if policy requires it and perform/review connection installation. This is an interactive access decision explicitly excluded from treating prototype approval as an account/credential grant. The parent should coordinate it once, rather than request inaccessible historical logs or production credentials.

Before installation, select the test-only transport: a temporary credential-free HTTPS endpoint with an isolated synthetic OAuth issuer reachable by ChatGPT's browser/client, or an expressly approved existing test tunnel. No endpoint currently exists. Do not deploy to the production Supabase project or claim Sites website tools provide the needed OAuth/MCP runtime without validating that contract.

[Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) requires a Platform tunnel ID, runtime API key and workspace association. It is not credential-free infrastructure; do not create a key/tunnel under this approval. Its OAuth issuer must remain independently reachable. An existing explicitly approved test tunnel could be supplied without exposing its secret.

Do not ask the user to paste secrets. A synthetic OAuth consent screen must state no external account or database access, one dummy subject and test-only scope, short expiry, explicit session lifetime, and removal instructions. This authorizes a test connection only; no human/agent production identity is involved.

## Frozen minimum test contract

One read-only closed-world tool, no skills/UI and no write operations. Input is one non-secret test nonce. It cannot accept project/workspace/principal identifiers, token values, arbitrary URLs/SQL or file paths. Output is a fixed synthetic fixture plus a fresh non-secret server receipt and boolean auth verification; it never returns tokens, authorization codes, identity claims or raw errors.

The companion tool-contract JSON is a preparation artifact, not an installed plugin or executable OAuth server. The synthetic issuer should implement the selected supported OAuth discovery, authorization-code/PKCE, resource binding and bearer validation. Keys/codes/access/refresh tokens are generated test-only in memory, never committed or printed, and cannot authenticate against any real project. Do not weaken audience or issuer checks to make a client pass.

## Execution sequence after setup

1. Install the authorized test connection and call the probe in the actual intended chat. Match its receipt with sanitized server metadata to prove tool selection and real request handling.
2. Complete synthetic OAuth consent through the client UI. Prove the bearer-verified call succeeds and missing/invalid/expired/wrong-audience/wrong-scope calls fail. Local client calls alone cannot prove ChatGPT client behavior.
3. Only after a harmless manual call succeeds, create one explicitly test-only, one-time scheduled task in that same connection context. Its prompt calls only hq_compatibility_probe with a public nonce and reports the returned receipt, never other tools. No production task is edited or run. This also satisfies the prerequisite to read the required app before creating an app-dependent automation.
4. Correlate scheduled run record/tool discovery, actual tool result and sanitized server receipt. If the task cannot discover/use the connection or requires unsupported unattended authorization, stop and report the exact limitation.
5. To prove refresh, allow the synthetic access token to expire while a test-only refresh session remains valid, then run a second separately scoped test invocation in the same actual runtime. Record that the refresh endpoint was used and the subsequent probe authenticated. A local refresh unit test or long-lived token is not proof of scheduled refresh.
6. Revoke the test session and prove a further scoped call fails. Remove the test connection, tasks and endpoint/tunnel process; preserve only sanitized evidence. Never kill unknown processes.

A successful synthetic OAuth test still does not certify Supabase project-issued token audience/RLS compatibility. That must be covered in the consolidated production proposal/approved isolated project-Auth acceptance. Do not forward synthetic tokens to production or infer that OAuth scopes confer database authority.

## Evidence and stopping rule

Current status: setup blocked, zero runtime tests executed; no local protocol pass claimed. Record each later result separately as local protocol, interactive ChatGPT, actual scheduled call, actual scheduled refresh and project Auth/RLS. Require actual scheduled authenticated discovery/call before preparing the consolidated production hosting/auth/identity/access/token/RLS/tools/revocation/rotation/deployment/testing/rollback packet. If setup or authentication cannot be supported cleanly, stop instead of creating an admin SQL fallback or a replacement scheduler.

The existing planner decision remains a proposal. Morning stays paused and all HQ flags stay off.
