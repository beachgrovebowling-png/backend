const test = require('node:test');
const assert = require('node:assert/strict');
const Visitor = require('../src/models/Visitor');
const { classifyDevice, detectBrowser, normalizePagePath, visitorDateWindows } = require('../src/visitor');
const { hasEmailConfiguration, sendVisitorNotification } = require('../src/visitorNotifications');

test('visitor device and browser detection classify common mobile, tablet, and desktop agents', () => {
  assert.equal(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'), 'mobile');
  assert.equal(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), 'tablet');
  assert.equal(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'), 'desktop');
  assert.equal(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0'), 'Edge');
  assert.equal(detectBrowser('Mozilla/5.0 Firefox/119.0'), 'Firefox');
  assert.equal(detectBrowser('unknown agent'), 'Unknown');
});

test('visitor page path excludes external destinations, query strings, and malformed input', () => {
  assert.equal(normalizePagePath('/#catalogue'), '/#catalogue');
  assert.equal(normalizePagePath('/products/ball'), '/products/ball');
  assert.equal(normalizePagePath('https://example.com/'), null);
  assert.equal(normalizePagePath('//example.com/'), null);
  assert.equal(normalizePagePath('/?email=private@example.com'), null);
  assert.equal(normalizePagePath('/bad\npath'), null);
});

test('visitor dashboard windows begin at UTC day, Monday, and month boundaries', () => {
  const windows = visitorDateWindows(new Date('2026-11-06T02:06:24.267Z'));
  assert.equal(windows.today.toISOString(), '2026-11-06T00:00:00.000Z');
  assert.equal(windows.week.toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(windows.month.toISOString(), '2026-11-01T00:00:00.000Z');
});

test('visitor records have MongoDB session deduplication and activity indexes', () => {
  const indexes = Visitor.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.sessionId === 1 && options.unique === true));
  assert.ok(indexes.some(([fields]) => fields.createdAt === -1));
});

test('email configuration requires a recipient in addition to Resend credentials', () => {
  const savedApiKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.VISITOR_NOTIFICATION_FROM;
  const savedRecipient = process.env.VISITOR_NOTIFICATION_EMAIL;
  process.env.RESEND_API_KEY = 'unit-test-key';
  process.env.VISITOR_NOTIFICATION_FROM = 'BowlersMechanic <alerts@example.com>';
  delete process.env.VISITOR_NOTIFICATION_EMAIL;

  try {
    assert.equal(hasEmailConfiguration(''), false);
    assert.equal(hasEmailConfiguration('not-an-email'), false);
    assert.equal(hasEmailConfiguration('owner@example.com'), true);
  } finally {
    if (savedApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedApiKey;
    if (savedFrom === undefined) delete process.env.VISITOR_NOTIFICATION_FROM;
    else process.env.VISITOR_NOTIFICATION_FROM = savedFrom;
    if (savedRecipient === undefined) delete process.env.VISITOR_NOTIFICATION_EMAIL;
    else process.env.VISITOR_NOTIFICATION_EMAIL = savedRecipient;
  }
});

test('visitor alert sends the expected details through the backend Resend configuration', async () => {
  const savedFetch = global.fetch;
  const savedApiKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.VISITOR_NOTIFICATION_FROM;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer unit-test-key');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ['owner@example.com']);
    assert.equal(body.subject, 'New Visitor on BowlersMechanic!');
    assert.match(body.text, /Page visited: \/#catalogue/);
    assert.match(body.text, /Device: Mobile/);
    assert.match(body.text, /Browser: Safari/);
    return { ok: true };
  };
  process.env.RESEND_API_KEY = 'unit-test-key';
  process.env.VISITOR_NOTIFICATION_FROM = 'BowlersMechanic <alerts@example.com>';

  try {
    await sendVisitorNotification({
      createdAt: new Date('2026-11-06T02:00:00.000Z'),
      page: '/#catalogue',
      device: 'mobile',
      browser: 'Safari'
    }, 'owner@example.com');
  } finally {
    global.fetch = savedFetch;
    if (savedApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedApiKey;
    if (savedFrom === undefined) delete process.env.VISITOR_NOTIFICATION_FROM;
    else process.env.VISITOR_NOTIFICATION_FROM = savedFrom;
  }
});

test('public visitor event and admin visitor activity endpoints fail safely without MongoDB', async () => {
  const { app } = require('../server');
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const visitorResponse = await fetch(`${baseUrl}/api/visitors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: '4cb7a45e-6068-4a88-bbc3-eab608713214',
        page: '/'
      })
    });
    assert.equal(visitorResponse.status, 503);
    assert.match((await visitorResponse.json()).error, /temporarily unavailable/);

    const adminResponse = await fetch(`${baseUrl}/api/admin/visitors`);
    assert.equal(adminResponse.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
