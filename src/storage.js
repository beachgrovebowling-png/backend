const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const localDirectory = path.resolve(process.env.MEDIA_LOCAL_DIRECTORY || path.join(__dirname, '..', 'uploads'));
const mimeExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

function r2MissingVariables() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];
  return required.filter(name => !String(process.env[name] || '').trim());
}

function isValidPublicBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function isR2Configured() {
  return r2MissingVariables().length === 0 && isValidPublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);
}

function isPersistentLocalStorageConfigured() {
  return process.env.MEDIA_LOCAL_PERSISTENT === 'true' && Boolean(process.env.MEDIA_LOCAL_DIRECTORY);
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
  });
}

function classifyR2Error(error) {
  const name = String(error?.name || error?.Code || error?.code || 'UnknownError').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) || 'UnknownError';
  const httpStatus = Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0) || null;
  const code = String(error?.Code || error?.code || name).toLowerCase();
  if (/invalidaccesskeyid|signaturedoesnotmatch|invalidtoken|expiredtoken/.test(code)) return { category: 'authentication', errorName: name, httpStatus };
  if (/nosuchbucket|(?:^|[^a-z])notfound(?:$|[^a-z])/.test(code) || httpStatus === 404) return { category: 'bucket_not_found_or_unavailable', errorName: name, httpStatus };
  if (/accessdenied|forbidden|allaccessdisabled/.test(code) || httpStatus === 403) return { category: 'permission_denied', errorName: name, httpStatus };
  if (/enotfound|eai_again|econnrefused|econnreset|etimedout|timeout|network|dns/.test(`${code} ${String(error?.message || '')}`.toLowerCase())) return { category: 'network_or_dns', errorName: name, httpStatus };
  return { category: 'r2_request_failed', errorName: name, httpStatus };
}

async function checkR2Connection(client) {
  if (!isR2Configured()) {
    return { configured: false, connected: false, missingVariables: r2MissingVariables(), invalidPublicBaseUrl: !isValidPublicBaseUrl(process.env.R2_PUBLIC_BASE_URL || '') };
  }
  try {
    await (client || getR2Client()).send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
    return { configured: true, connected: true };
  } catch (error) {
    return { configured: true, connected: false, ...classifyR2Error(error) };
  }
}

function logR2ConnectionResult(result) {
  if (result.connected) {
    console.info('Cloudflare R2 HeadBucket check succeeded.');
  } else if (!result.configured) {
    const missing = result.missingVariables || [];
    console.warn(`Cloudflare R2 is not configured. Missing variables: ${missing.join(', ') || 'none'}${result.invalidPublicBaseUrl ? '; R2_PUBLIC_BASE_URL must be a valid HTTPS public URL' : ''}.`);
  } else {
    const messages = {
      authentication: 'R2 rejected the configured S3 credentials',
      permission_denied: 'R2 denied HeadBucket; check token permissions and bucket access',
      bucket_not_found_or_unavailable: 'R2 could not find or expose the configured bucket',
      network_or_dns: 'The backend could not reach the R2 S3 endpoint',
      r2_request_failed: 'The R2 HeadBucket request failed'
    };
    console.error(`Cloudflare R2 HeadBucket check failed: category=${result.category}, error=${result.errorName}, httpStatus=${result.httpStatus || 'unknown'}, message=${messages[result.category] || messages.r2_request_failed}.`);
  }
}

async function putImage(buffer, mimeType, client) {
  const extension = mimeExtensions[mimeType];
  if (!extension) throw new Error('Unsupported image format.');
  if (process.env.NODE_ENV === 'production' && !isR2Configured() && !isPersistentLocalStorageConfigured()) {
    throw new Error('Persistent image storage is not configured. Set the R2 storage variables or point MEDIA_LOCAL_DIRECTORY at a mounted persistent disk and set MEDIA_LOCAL_PERSISTENT=true.');
  }
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
  if (isR2Configured()) {
    await (client || getR2Client()).send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
    return { key, url: `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`, storage: 'r2' };
  }
  const destination = path.resolve(localDirectory, key);
  if (!destination.startsWith(`${localDirectory}${path.sep}`)) throw new Error('Invalid media path.');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer, { flag: 'wx' });
  return { key, url: `/media/${key}`, storage: 'local' };
}

async function deleteImage(media) {
  if (media.storage === 'r2') {
    if (!isR2Configured()) throw new Error('R2 storage is not currently configured; refusing to delete metadata only.');
    await getR2Client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: media.key }));
    return;
  }
  const destination = path.resolve(localDirectory, media.key);
  if (!destination.startsWith(`${localDirectory}${path.sep}`)) throw new Error('Invalid media path.');
  await fs.unlink(destination);
}

function storageStatus() {
  const persistentAcrossDeploys = isR2Configured() || isPersistentLocalStorageConfigured();
  return { provider: isR2Configured() ? 'Cloudflare R2' : 'Local disk', persistentAcrossDeploys, configured: process.env.NODE_ENV !== 'production' || persistentAcrossDeploys };
}

module.exports = { checkR2Connection, classifyR2Error, deleteImage, isR2Configured, localDirectory, logR2ConnectionResult, putImage, storageStatus };