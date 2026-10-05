// Local fresh browser only. Never touches the public tunnel or real identity.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.HQ_TEST_PLAYWRIGHT_MODULE || 'playwright');

const code = `
import json,threading,base64,hashlib,os
from urllib.parse import urlencode
from probe import ProbeServer,SCOPE
s=ProbeServer(origin='https://synthetic-hq.invalid')
callback=os.environ['HQ_SYNTHETIC_CALLBACK']
s.oauth.redirects.add(callback)
s.oauth.access_ttl=2
client=s.oauth.register({'redirect_uris':[callback]})['client_id']
challenge=base64.urlsafe_b64encode(hashlib.sha256(('v'*64).encode()).digest()).rstrip(b'=').decode()
p={'client_id':client,'redirect_uri':callback,'response_type':'code','scope':SCOPE,'resource':s.origin+'/mcp','state':'local-browser-test','code_challenge':challenge,'code_challenge_method':'S256'}
print(json.dumps({'origin':s.origin,'backend':'http://127.0.0.1:'+str(s.server_port),'url':s.origin+'/authorize?'+urlencode(p)}),flush=True)
s.serve_forever()
`;

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-browser-tls-'));
  const keyPath = path.join(temp, 'key.pem');
  const certPath = path.join(temp, 'cert.pem');
  execFileSync('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  fs.chmodSync(keyPath, 0o600);
  let callbackCode;
  let callbackState;
  const callbackServer = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, (req, res) => {
    const url = new URL(req.url, 'https://localhost');
    if (url.pathname === '/callback') {
      callbackCode = url.searchParams.get('code');
      callbackState = url.searchParams.get('state');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<p>Synthetic callback received</p>');
  });
  await new Promise(resolve => callbackServer.listen(0, '127.0.0.1', resolve));
  const callbackOrigin = 'https://127.0.0.1:' + callbackServer.address().port;
  const child = spawn('python3', ['-u', '-c', code], { cwd: __dirname, env: { ...process.env, HQ_SYNTHETIC_CALLBACK: callbackOrigin + '/callback' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const rl = readline.createInterface({ input: child.stdout });
    const info = await new Promise((resolve, reject) => {
      rl.once('line', value => resolve(JSON.parse(value)));
      child.once('exit', () => reject(new Error('Local fixture failed')));
    });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const results = [];
    for (const [policy, callbackAllowed] of [['no-referrer', false], ['same-origin', false], ['same-origin', true]]) {
      // Certificate bypass applies only to this generated loopback test certificate.
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      callbackCode = undefined;
      callbackState = undefined;
      let consentStatus;
      let cspFormBlocked = false;
      page.on('console', message => { if (message.text().includes('form-action')) cspFormBlocked = true; });
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === callbackOrigin && url.pathname === '/callback') return route.continue();
        if (url.origin !== info.origin) return route.abort();
        const headers = { ...request.headers() };
        delete headers.host;
        delete headers['content-length'];
        const response = await fetch(info.backend + url.pathname + url.search, {
          method: request.method(), headers,
          body: request.method() === 'POST' ? request.postDataBuffer() : undefined,
          redirect: 'manual',
        });
        const responseHeaders = Object.fromEntries(response.headers.entries());
        if (url.pathname === '/consent') consentStatus = response.status;
        if (url.pathname === '/authorize') {
          responseHeaders['referrer-policy'] = policy;
          if (!callbackAllowed) responseHeaders['content-security-policy'] = "default-src 'none'; form-action 'self'; frame-ancestors 'none'";
        }
        await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
      });
      let origin;
      page.on('request', request => {
        if (request.url() === info.origin + '/consent') origin = request.headers()['origin'];
      });
      await page.goto(info.url);
      await page.getByRole('button', { name: 'Approve synthetic test only' }).click({ noWaitAfter: true });
      const deadline = Date.now() + 3000;
      while (!consentStatus && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(consentStatus);
      const callbackDeadline = Date.now() + (callbackAllowed ? 3000 : 100);
      while (!callbackCode && Date.now() < callbackDeadline) await new Promise(resolve => setTimeout(resolve, 20));
      const result = { policy, callbackAllowed, consent_status: consentStatus, origin_null: origin === 'null', origin_matches: origin === info.origin, callback_received: Boolean(callbackCode), csp_form_blocked: cspFormBlocked };
      console.log(JSON.stringify({ local_browser_stage: result }));
      if (callbackAllowed) {
        assert.ok(callbackCode);
        assert.equal(callbackState, 'local-browser-test');
        const client = new URL(info.url).searchParams.get('client_id');
        const tokenResponse = await fetch(info.backend + '/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client, redirect_uri: callbackOrigin + '/callback', code: callbackCode, code_verifier: 'v'.repeat(64), resource: info.origin + '/mcp' }) });
        assert.equal(tokenResponse.status, 200);
        const tokens = await tokenResponse.json();
        const probe = async token => fetch(info.backend + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'hq_compatibility_probe', arguments: { test_nonce: 'local-browser-roundtrip' } } }) });
        assert.equal((await probe(tokens.access_token)).status, 200);
        await new Promise(resolve => setTimeout(resolve, 2100));
        assert.equal((await probe(tokens.access_token)).status, 401);
        const refreshedResponse = await fetch(info.backend + '/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client, refresh_token: tokens.refresh_token, resource: info.origin + '/mcp' }) });
        assert.equal(refreshedResponse.status, 200);
        const refreshed = await refreshedResponse.json();
        assert.equal((await probe(refreshed.access_token)).status, 200);
        const revokedResponse = await fetch(info.backend + '/revoke', { method: 'POST', body: new URLSearchParams({ client_id: client, token: refreshed.refresh_token }) });
        assert.equal(revokedResponse.status, 200);
        assert.equal((await probe(refreshed.access_token)).status, 401);
        result.local_token_probe_expiry_refresh_revocation_passed = true;
      }
      results.push(result);
      await context.close();
    }
    assert.equal(results[0].origin_null, true);
    assert.equal(results[0].consent_status, 403);
    assert.equal(results[1].origin_matches, true);
    assert.equal(results[1].consent_status, 303);
    assert.equal(results[1].callback_received, false);
    assert.equal(results[1].csp_form_blocked, true);
    assert.equal(results[2].callback_received, true);
    console.log(JSON.stringify({ local_browser_regression_passed: true, results }));
  } finally {
    if (browser) await browser.close();
    child.kill('SIGTERM');
    await new Promise(resolve => callbackServer.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error('Local browser test failed: ' + error.name); process.exitCode = 1; });
