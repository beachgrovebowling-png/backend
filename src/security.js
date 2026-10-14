const crypto = require('node:crypto');

function createCsrfToken(session) {
  if (!session.csrfToken) session.csrfToken = crypto.randomBytes(32).toString('hex');
  return session.csrfToken;
}

function csrfProtection(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const supplied = request.get('x-csrf-token') || request.body?._csrf;
  const expected = request.session?.csrfToken;
  if (!supplied || !expected) return response.status(403).json({ error: 'Security token missing or expired. Reload the page and try again.' });
  const suppliedBuffer = Buffer.from(String(supplied));
  const expectedBuffer = Buffer.from(String(expected));
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return response.status(403).json({ error: 'Security token is invalid. Reload the page and try again.' });
  }
  next();
}

function requireAdmin(request, response, next) {
  const sessionAdmin = request.session?.admin;
  if (!sessionAdmin?.id) return response.status(401).json({ error: 'Your admin session has expired. Sign in again.' });
  const Admin = require('./models/Admin');
  Admin.findById(sessionAdmin.id).select('active passwordChangedAt').then(admin => {
    const authenticatedAt = Number(request.session.authenticatedAt) || 0;
    if (!admin?.active || (admin.passwordChangedAt && admin.passwordChangedAt.getTime() > authenticatedAt)) {
      return request.session.destroy(() => response.status(401).json({ error: 'Your admin access changed. Sign in again.' }));
    }
    next();
  }).catch(error => {
    console.error(`Admin session validation failed: ${error.message}`);
    response.status(503).json({ error: 'Admin access could not be verified because the database is unavailable.' });
  });
}

function cleanText(value, maxLength = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

module.exports = { createCsrfToken, csrfProtection, requireAdmin, cleanText };