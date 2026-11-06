const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const localDirectory = path.resolve(process.env.MEDIA_LOCAL_DIRECTORY || path.join(__dirname, '..', 'uploads'));
const mimeExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL);
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

async function putImage(buffer, mimeType) {
  const extension = mimeExtensions[mimeType];
  if (!extension) throw new Error('Unsupported image format.');
  if (process.env.NODE_ENV === 'production' && !isR2Configured() && !isPersistentLocalStorageConfigured()) {
    throw new Error('Persistent image storage is not configured. Set the R2 storage variables or point MEDIA_LOCAL_DIRECTORY at a mounted persistent disk and set MEDIA_LOCAL_PERSISTENT=true.');
  }
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
  if (isR2Configured()) {
    await getR2Client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
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

module.exports = { deleteImage, isR2Configured, localDirectory, putImage, storageStatus };