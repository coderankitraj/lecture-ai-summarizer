const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createServerApp } = require('./server.js');

function jsonRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('health route reports fallback state when no Gemini key is set', async () => {
  const server = createServerApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const response = await jsonRequest(server, 'GET', '/api/health');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.provider, 'fallback');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('summarize endpoint returns a summary for valid lecture text', async () => {
  const server = createServerApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const response = await jsonRequest(server, 'POST', '/api/summarize', {
      text: 'Machine learning helps computers learn from data. It is used for prediction, classification, and pattern recognition.',
      mode: 'page'
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body.summary, /QUICK SUMMARY|Key content/i);
    assert.equal(response.body.provider, 'fallback');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('summarize endpoint enforces the configured request limit', async () => {
  const server = createServerApp({ rateLimitMaxRequests: 1, rateLimitWindowMs: 60_000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const body = {
      text: 'Machine learning helps computers learn from data and recognize useful patterns.',
      mode: 'page'
    };
    const firstResponse = await jsonRequest(server, 'POST', '/api/summarize', body);
    const secondResponse = await jsonRequest(server, 'POST', '/api/summarize', body);

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.headers['cache-control'], 'no-store');
    assert.equal(secondResponse.statusCode, 429);
    assert.ok(Number(secondResponse.headers['retry-after']) > 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
