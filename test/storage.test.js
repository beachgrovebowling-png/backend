const test = require('node:test');
const assert = require('node:assert/strict');
const { HeadBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { checkR2Connection, putImage } = require('../src/storage');

const r2Keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];

function withR2Environment(values, callback) {
  const previous = Object.fromEntries(r2Keys.map(key => [key, process.env[key]]));
  for (const key of r2Keys) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  return Promise.resolve().then(callback).finally(() => {
    for (const key of r2Keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test('R2 connectivity reports missing required environment variables without sending a request', async () => {
  await withR2Environment({ R2_ACCOUNT_ID: 'account-id' }, async () => {
    let sent = false;
    const result = await checkR2Connection({ send: async () => { sent = true; } });
    assert.equal(result.configured, false);
    assert.equal(result.connected, false);
    assert.ok(result.missingVariables.includes('R2_BUCKET'));
    assert.equal(sent, false);
  });
});

test('R2 connectivity sends HeadBucket to the configured bucket', async () => {
  await withR2Environment({
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET: 'bowlers-images',
    R2_PUBLIC_BASE_URL: 'https://images.example.com'
  }, async () => {
    let command;
    const result = await checkR2Connection({ send: async value => { command = value; } });
    assert.equal(result.configured, true);
    assert.equal(result.connected, true);
    assert.ok(command instanceof HeadBucketCommand);
    assert.equal(command.input.Bucket, 'bowlers-images');
  });
});

test('R2 connectivity classifies authentication, permissions, missing bucket, and networking failures', async () => {
  const base = {
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET: 'bowlers-images',
    R2_PUBLIC_BASE_URL: 'https://images.example.com'
  };
  const cases = [
    [{ name: 'SignatureDoesNotMatch', $metadata: { httpStatusCode: 403 } }, 'authentication'],
    [{ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }, 'permission_denied'],
    [{ name: 'NotFound', $metadata: { httpStatusCode: 404 } }, 'bucket_not_found_or_unavailable'],
    [{ name: 'Error', code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' }, 'network_or_dns']
  ];
  await withR2Environment(base, async () => {
    for (const [error, category] of cases) {
      const result = await checkR2Connection({ send: async () => { throw error; } });
      assert.equal(result.connected, false);
      assert.equal(result.category, category);
      assert.equal(result.httpStatus, error.$metadata?.httpStatusCode || null);
    }
  });
});

test('R2 image uploads use the bucket for S3 and the public HTTPS base for the saved URL', async () => {
  await withR2Environment({
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET: 'bowlers-images',
    R2_PUBLIC_BASE_URL: 'https://pub.example.r2.dev/'
  }, async () => {
    let command;
    const stored = await putImage(Buffer.from('image bytes'), 'image/jpeg', { send: async value => { command = value; } });
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.Bucket, 'bowlers-images');
    assert.equal(command.input.ContentType, 'image/jpeg');
    assert.equal(command.input.CacheControl, 'public, max-age=31536000, immutable');
    assert.match(stored.key, /^\d{4}-\d{2}-\d{2}\/.+\.jpg$/);
    assert.equal(stored.url, `https://pub.example.r2.dev/${stored.key}`);
    assert.equal(stored.storage, 'r2');
  });
});