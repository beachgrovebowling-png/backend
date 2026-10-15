require('dotenv').config();

const fs = require('node:fs');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Product = require('./src/models/Product');
const Category = require('./src/models/Category');
const Order = require('./src/models/Order');
const SiteSettings = require('./src/models/SiteSettings');
const { catalogCategories, starterProducts } = require('./src/catalog');
const { buildWhatsAppMessage, configuredWhatsAppNumber, validateOrder } = require('./src/order');
const { csrfProtection } = require('./src/security');
const { localDirectory, storageStatus } = require('./src/storage');
const adminRouter = require('./src/adminRouter');

const app = express();
app.set('trust proxy', 1);
const publicDirectory = path.join(__dirname, '..', 'frontend', 'public');
const hasStaticFrontend = fs.existsSync(publicDirectory) && fs.existsSync(path.join(publicDirectory, 'index.html'));
const rawFrontendUrl = String(process.env.FRONTEND_URL || '').trim();
const isCrossSiteFrontend = Boolean(rawFrontendUrl) && !rawFrontendUrl.includes('localhost');
const sessionCookieSameSite = String(process.env.SESSION_COOKIE_SAME_SITE || (isCrossSiteFrontend ? 'none' : 'strict')).toLowerCase();
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: sessionCookieSameSite === 'lax' || sessionCookieSameSite === 'strict' || sessionCookieSameSite === 'none' ? sessionCookieSameSite : (isCrossSiteFrontend ? 'none' : 'strict'),
  secure: process.env.NODE_ENV === 'production' || process.env.SESSION_COOKIE_SECURE === 'true',
  maxAge: 8 * 60 * 60 * 1000
};
const allowedOrigins = Array.from(new Set([
  rawFrontendUrl,
  process.env.CORS_ORIGINS || '',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
].flatMap(value => String(value || '').split(',')).map(item => item.trim()).filter(Boolean)));
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
}

app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, Cookie');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use(express.urlencoded({ extended: false, limit: '12kb' }));
app.use(express.json({ limit: '12kb' }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"], formAction: ["'self'", 'https://wa.me'], frameAncestors: ["'none'"]
  } }
}));
class DelegatingSessionStore extends session.Store {
  constructor() {
    super();
    this.fallback = new session.MemoryStore();
    this.activeStore = this.fallback;
  }

  use(store) {
    this.activeStore = store;
    store.on('error', error => console.error(`MongoDB session store error: ${error.message}`));
  }

  get(...args) { return this.activeStore.get(...args); }
  set(...args) { return this.activeStore.set(...args); }
  destroy(...args) { return this.activeStore.destroy(...args); }
  touch(...args) { return this.activeStore.touch(...args); }
}

const sessionStore = new DelegatingSessionStore();
app.use(session({
  name: 'bm.admin.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-session-secret-before-deploying',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: sessionCookieOptions
}));
if (hasStaticFrontend) {
  app.use(express.static(publicDirectory));
}
app.use('/media', express.static(localDirectory, { fallthrough: false, immutable: true, maxAge: '1y' }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' } });
app.use('/api/admin/login', loginLimiter);
app.get('/api/health', async (request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  response.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    databaseConnected,
    frontendConfigured: Boolean(rawFrontendUrl),
    timestamp: new Date().toISOString()
  });
});
app.use('/api/admin', csrfProtection, adminRouter);

function publicProduct(product) {
  const availability = product.stockQuantity === 0
    ? 'out-of-stock'
    : product.stockQuantity == null && product.availability !== 'out-of-stock'
      ? 'contact'
      : (product.availability || 'contact');
  const resolvedPrice = product.pricingRule === 'storm-ice-quantity-offer' && Number.isInteger(product.price) ? product.price : (product.priceConfirmed === true && Number.isFinite(product.price) ? product.price : null);
  const weights = Array.isArray(product.weights) ? product.weights.map(weight => ({ label: String(weight.label || `${weight.value} lb`), value: Number(weight.value), available: Boolean(weight.available ?? true) })) : [];
  return {
    id: String(product._id || product.slug),
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    image: product.image || null,
    price: resolvedPrice,
    salePrice: product.priceConfirmed === true && Number.isFinite(product.salePrice) ? product.salePrice : null,
    availability,
    stockQuantity: Number.isInteger(product.stockQuantity) ? product.stockQuantity : null,
    featured: Boolean(product.featured),
    isStarter: Boolean(product.isStarter),
    gallery: product.gallery || [],
    shortDescription: product.shortDescription || product.description,
    fullDescription: product.fullDescription || product.description,
    imageAlt: product.imageAlt || `${product.brand} ${product.name}`,
    status: product.status || 'published',
    categoryLabel: product.category,
    weights,
    pricingRule: product.pricingRule || 'contact',
    offers: Array.isArray(product.offers) ? product.offers : []
  };
}

function orderWhatsAppNumber(data) {
  if (data?.whatsapp) return data.whatsapp.enabled ? configuredWhatsAppNumber(data.whatsapp.number) : null;
  return configuredWhatsAppNumber();
}

function errorPage(message, status) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order enquiry not sent</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:38rem;margin:12vh auto;padding:1.5rem;color:#171717"><h1>Order enquiry not sent</h1><p>${message}</p><p>Return to BowlersMechanic and try again, or contact the store directly.</p></body></html>`;
}

app.get('/api/products', async (request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  try {
    const products = databaseConnected
      ? await Product.find({ active: true, $or: [{ status: 'published' }, { status: { $exists: false } }] }).sort({ featured: -1, name: 1 }).lean()
      : starterProducts;
    const categories = databaseConnected ? await Category.find({ published: true }).sort({ sortOrder: 1, name: 1 }).select('slug name').lean() : [];
    const settings = databaseConnected ? await SiteSettings.findOne({ key: 'main' }).lean() : null;
    response.json({
      products: products.map(publicProduct),
      categories,
      site: publicSiteSettings(settings?.data),
      databaseConnected,
      catalogMode: databaseConnected ? 'database' : 'starter-preview',
      whatsappConfigured: Boolean(orderWhatsAppNumber(settings?.data))
    });
  } catch (error) {
    console.error('Could not load products from MongoDB:', error.message);
    response.status(503).json({ error: 'The product catalogue is temporarily unavailable.' });
  }
});

function publicSiteSettings(data = {}) {
  const site = data.site || {};
  const homepage = data.homepage || {};
  const branding = data.branding || {};
  const footer = data.footer || {};
  const navigation = Array.isArray(data.navigation) ? data.navigation : [];
  return {
    site: { name: String(site.name || 'BowlersMechanic').slice(0, 100), currency: 'USD', announcement: String(site.announcement || '').slice(0, 240), announcementVisible: Boolean(site.announcementVisible), contactEmail: String(site.contactEmail || '').slice(0, 254), contactPhone: String(site.contactPhone || '').slice(0, 30) },
    homepage: {
      headline: String(homepage.headline || 'Find your next strike.').slice(0, 120),
      subtitle: String(homepage.subtitle || 'The right gear changes how you play. Explore the catalogue and talk directly with BowlersMechanic about your next setup.').slice(0, 500),
      heroImage: homepage.heroImage || null,
      primaryButtonText: String(homepage.primaryButtonText || 'Explore equipment').slice(0, 50),
      primaryButtonUrl: String(homepage.primaryButtonUrl || '#catalogue').slice(0, 300),
      secondaryButtonText: String(homepage.secondaryButtonText || '').slice(0, 50),
      secondaryButtonUrl: safePublicUrl(homepage.secondaryButtonUrl || ''),
      footerText: String(homepage.footerText || '').slice(0, 500)
    },
    branding: { logo: branding.logo || null, favicon: branding.favicon || null, colors: branding.colors || { ink: '#171717', paper: '#f4f3ef', orange: '#f15b2a', purple: '#8e71ad' } },
    navigation: navigation.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string').slice(0, 8).map(item => ({ label: String(item.label).slice(0, 40), url: safePublicUrl(item.url) })),
    footer: { text: String(footer.text || 'Good gear. Better frames.').slice(0, 300) },
    seo: { title: String((data.seo || {}).title || 'BowlersMechanic | Bowling Equipment').slice(0, 180), description: String((data.seo || {}).description || 'Browse bowling equipment at BowlersMechanic.').slice(0, 320), image: safePublicUrl((data.seo || {}).image || ''), canonicalUrl: /^https:\/\//i.test((data.seo || {}).canonicalUrl || '') ? String(data.seo.canonicalUrl).slice(0, 400) : '' }
  };
}

function safePublicUrl(value) {
  const url = String(value || '').trim();
  return url.startsWith('/') || /^https:\/\//i.test(url) ? url.slice(0, 300) : '#';
}

app.get('/api/site-config', async (request, response) => {
  try {
    const connected = mongoose.connection.readyState === 1;
    const settings = connected ? await SiteSettings.findOne({ key: 'main' }).lean() : null;
    response.json({ site: publicSiteSettings(settings?.data), storage: storageStatus(), databaseConnected: connected });
  } catch (error) {
    console.error('Could not load website settings:', error.message);
    response.status(503).json({ error: 'Website settings are temporarily unavailable.' });
  }
});

app.post('/api/orders/whatsapp', async (request, response) => {
  let settings;
  try {
    settings = mongoose.connection.readyState === 1 ? await SiteSettings.findOne({ key: 'main' }).lean() : null;
  } catch (error) {
    console.error('Could not load WhatsApp ordering settings:', error.message);
    return response.status(503).type('html').send(errorPage('The order service is temporarily unavailable. No request was recorded.', 503));
  }
  const whatsappConfig = settings?.data?.whatsapp;
  const whatsappNumber = orderWhatsAppNumber(settings?.data);
  if (!whatsappNumber) {
    return response.status(503).type('html').send(errorPage('The store WhatsApp number has not been configured with a complete international number. Please try again later.', 503));
  }

  try {
    if (mongoose.connection.readyState !== 1) return response.status(503).type('html').send(errorPage('The order service is unavailable because the catalogue database is not connected. Your request was not recorded.', 503));
    const products = await Product.find({ active: true, $or: [{ status: 'published' }, { status: { $exists: false } }] }).lean();
    const result = validateOrder(request.body, products);
    if (result.error) return response.status(400).type('html').send(errorPage(result.error, 400));

    const product = products.find(item => String(item._id || item.slug) === String(request.body.productId) || item.slug === String(request.body.productId));
    const prefix = String(whatsappConfig?.referencePrefix || 'BM').replace(/[^A-Za-z0-9-]/g, '').slice(0, 8) || 'BM';
    const reference = `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${cryptoRandomReference()}`;
    const order = await Order.create({
      reference,
      customer: { name: result.order.customerName, phone: result.order.customerPhone, email: result.order.email },
      product: { productId: product._id, name: product.name, brand: product.brand, sku: product.sku || '', unitPrice: product.priceConfirmed === true && Number.isFinite(product.price) ? product.price : null, quantity: result.order.quantity },
      requirements: result.order.requirements,
      status: 'request-recorded',
      history: [{ status: 'request-recorded', note: 'Customer submitted the website form; WhatsApp message may not have been sent.' }]
    });
    const substitutions = { reference, name: result.order.customerName, product: `${product.brand} ${product.name}`, quantity: String(result.order.quantity) };
    const customMessage = String(whatsappConfig?.defaultMessage || '').slice(0, 500).replace(/\{(reference|name|product|quantity)\}/g, (_, key) => substitutions[key]);
    const greeting = String(whatsappConfig?.greeting || '').trim().slice(0, 200);
    const messageParts = [greeting, customMessage, buildWhatsAppMessage(result.order), `Order reference: ${reference}`].filter(Boolean);
    const message = encodeURIComponent(messageParts.join('\n\n'));
    response.set('Referrer-Policy', 'no-referrer');
    response.redirect(303, `https://wa.me/${whatsappNumber}?text=${message}`);
    console.info(`Order request ${order.reference} recorded; WhatsApp send status is unknown.`);
  } catch (error) {
    console.error('Could not validate order against the catalogue:', error.message);
    response.status(503).type('html').send(errorPage('The catalogue is temporarily unavailable, so this enquiry could not be checked. Please try again shortly.', 503));
  }
});

function cryptoRandomReference() {
  return require('node:crypto').randomBytes(3).toString('hex').toUpperCase();
}

if (hasStaticFrontend) {
  app.get(['/admin', '/admin/*'], (request, response) => response.sendFile(path.join(publicDirectory, 'admin.html')));
  app.get('*', (request, response) => {
    response.sendFile(path.join(publicDirectory, 'index.html'));
  });
}

app.use('/api', (request, response) => response.status(404).json({ error: 'API endpoint not found.' }));

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  const status = error instanceof require('multer').MulterError ? 400 : (error.status >= 400 && error.status < 600 ? error.status : 500);
  console.error(`Request failed: ${request.method} ${request.originalUrl} -> ${error.message}`);
  response.status(status).json({ error: status === 500 ? 'The server could not complete this request.' : error.message });
});

async function ensureCatalogSeed() {
  if (mongoose.connection.readyState !== 1) return;
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    await Category.insertMany(catalogCategories.map(category => ({ ...category, slug: String(category.slug).trim().toLowerCase() })));
  }
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany(starterProducts.map(product => ({ ...product, slug: String(product.slug).trim().toLowerCase() })));
  }
}

function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not set. Serving the read-only starter catalogue; product changes are not persistent.');
    return Promise.resolve(false);
  }

  return mongoose.connect(uri).then(async () => {
    sessionStore.use(MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'admin_sessions', ttl: 8 * 60 * 60 }));
    await ensureCatalogSeed();
    console.log('Connected to MongoDB.');
    return true;
  }).catch(error => {
    console.error(`MongoDB connection failed: ${error.message}`);
    return false;
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  connectDatabase();
  const server = app.listen(port, () => console.log(`BowlersMechanic is running at http://localhost:${port}`));
  const shutdown = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { app, connectDatabase };