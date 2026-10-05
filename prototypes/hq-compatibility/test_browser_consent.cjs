// Local fresh browser only. Never touches the public tunnel or real identity.
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.HQ_TEST_PLAYWRIGHT_MODULE || 'playwright');

const code = `
import json,threading,base64,hashlib
from urllib.parse import urlencode
from probe import ProbeServer,SCOPE
s=ProbeServer(origin='https://synthetic-hq.invalid')
callback=s.origin+'/test-callback'
s.oauth.redirects.add(callback)
client=s.oauth.register({'redirect_uris':[callback]})['client_id']
challenge=base64.urlsafe_b64encode(hashlib.sha256(('v'*64).encode()).digest()).rstrip(b'=').decode()
p={'client_id':client,'redirect_uri':callback,'response_type':'code','scope':SCOPE,'resource':s.origin+'/mcp','state':'local-browser-test','code_challenge':challenge,'code_challenge_method':'S256'}
print(json.dumps({'origin':s.origin,'backend':'http://127.0.0.1:'+str(s.server_port),'url':s.origin+'/authorize?'+urlencode(p)}),flush=True)
s.serve_forever()
`;

(async () => {
  const child = spawn('python3', ['-u', '-c', code], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const rl = readline.createInterface({ input: child.stdout });
    const info = await new Promise((resolve, reject) => {
      rl.once('line', value => resolve(JSON.parse(value)));
      child.once('exit', () => reject(new Error('Local fixture failed')));
    });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const results = [];
    for (const policy of ['no-referrer', 'same-origin']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
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
        if (url.pathname === '/authorize') responseHeaders['referrer-policy'] = policy;
        await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
      });
      let origin;
      page.on('request', request => {
        if (request.url() === info.origin + '/consent') origin = request.headers()['origin'];
      });
      await page.goto(info.url);
      const responsePromise = page.waitForResponse(response => response.url() === info.origin + '/consent');
      await page.getByRole('button', { name: 'Approve synthetic test only' }).click();
      const response = await responsePromise;
      results.push({ policy, consent_status: response.status(), origin_null: origin === 'null', origin_matches: origin === info.origin });
      await context.close();
    }
    assert.equal(results[0].origin_null, true);
    assert.equal(results[0].consent_status, 403);
    assert.equal(results[1].origin_matches, true);
    assert.equal(results[1].consent_status, 303);
    console.log(JSON.stringify({ local_browser_regression_passed: true, results }));
  } finally {
    if (browser) await browser.close();
    child.kill('SIGTERM');
  }
})().catch(error => { console.error('Local browser test failed: ' + error.name); process.exitCode = 1; });
