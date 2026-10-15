const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const multer = require('multer');
const { imageSize } = require('image-size');
const Admin = require('./models/Admin');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Brand = require('./models/Brand');
const Order = require('./models/Order');
const Media = require('./models/Media');
const SiteSettings = require('./models/SiteSettings');
const Activity = require('./models/Activity');
const { createCsrfToken, requireAdmin, cleanText } = require('./security');
const { deleteImage, putImage, storageStatus } = require('./storage');
const { configuredWhatsAppNumber } = require('./order');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_IMAGE_BYTES) || 8 * 1024 * 1024, files: 10 } });
const allowedImages = new Set(['jpg', 'png', 'webp', 'avif']);
const statusValues = ['request-recorded', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

function requireDatabase(request, response, next) {
  if (require('mongoose').connection.readyState !== 1) return response.status(503).json({ error: 'MongoDB is not connected. Changes cannot be saved.' });
  next();
}

function safeAdmin(admin) {
  return { id: String(admin._id), email: admin.email, name: admin.name, role: admin.role };
}

async function logActivity(admin, action, targetType, targetId, summary) {
  await Activity.create({ actor: admin._id, actorEmail: admin.email, action, targetType, targetId: String(targetId || ''), summary: cleanText(summary, 240) });
}

function validPrice(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10000000 ? number : NaN;
}

function makeSlug(value) {
  return cleanText(value, 160).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

async function validateProduct(body) {
  const name = cleanText(body.name, 120);
  const brand = cleanText(body.brand, 80);
  const slug = makeSlug(body.slug || name);
  const category = cleanText(body.category, 40);
  const price = validPrice(body.price);
  const salePrice = validPrice(body.salePrice);
  const stockQuantity = body.stockQuantity === '' || body.stockQuantity == null ? null : Number(body.stockQuantity);
  if (name.length < 2 || !brand || !slug) return { error: 'Name, brand, and a valid URL slug are required.' };
  const builtInCategories = ['bowling-ball', 'accessory', 'bag', 'apparel', 'other'];
  if (!builtInCategories.includes(category) && !await Category.exists({ slug: category })) return { error: 'Choose a category managed by the store.' };
  if (Number.isNaN(price) || Number.isNaN(salePrice)) return { error: 'Prices must be valid non-negative USD amounts.' };
  if (price !== null && !body.priceConfirmed) return { error: 'Confirm the price before publishing a numeric price.' };
  if (salePrice !== null && (price === null || salePrice > price)) return { error: 'Sale price must be set and no greater than the regular price.' };
  if (stockQuantity !== null && (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 10000000)) return { error: 'Stock must be a whole number, or left blank when unverified.' };
  if (stockQuantity === null && body.availability === 'available') return { error: 'Enter a verified stock quantity before marking this item in stock.' };
  const specifications = Array.isArray(body.specifications) ? body.specifications.slice(0, 40).map(item => ({ name: cleanText(item.name, 80), value: cleanText(item.value, 240) })).filter(item => item.name && item.value) : [];
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.slice(0, 30).map(tag => cleanText(tag, 40)).filter(Boolean))] : [];
  const gallery = Array.isArray(body.gallery) ? body.gallery.slice(0, 12).map(item => ({ url: cleanText(item.url, 500), alt: cleanText(item.alt, 240) })).filter(item => item.url.startsWith('/media/') || /^https:\/\//.test(item.url)) : [];
  const status = body.status === 'draft' ? 'draft' : 'published';
  return { product: {
    name, brand, slug, category,
    sku: cleanText(body.sku, 80),
    description: cleanText(body.shortDescription || body.description, 1200),
    shortDescription: cleanText(body.shortDescription || body.description, 280),
    fullDescription: cleanText(body.fullDescription || body.description, 8000),
    image: cleanText(body.image, 500) || null,
    imageAlt: cleanText(body.imageAlt, 240), gallery,
    price, salePrice,
    priceConfirmed: Boolean(body.priceConfirmed && price !== null),
    stockQuantity,
    lowStockThreshold: body.lowStockThreshold === '' || body.lowStockThreshold == null ? null : Math.max(0, Math.min(1000000, Number(body.lowStockThreshold))),
    availability: ['available', 'out-of-stock', 'contact'].includes(body.availability) ? body.availability : 'contact',
    condition: ['unspecified', 'new', 'used', 'refurbished'].includes(body.condition) ? body.condition : 'unspecified',
    specifications, tags,
    featured: Boolean(body.featured), active: status === 'published', status,
    seoTitle: cleanText(body.seoTitle, 180), seoDescription: cleanText(body.seoDescription, 320)
  } };
}

router.get('/csrf', (request, response) => response.json({ csrfToken: createCsrfToken(request.session) }));

router.post('/login', requireDatabase, async (request, response, next) => {
  try {
    const email = cleanText(request.body.email, 254).toLowerCase();
    const password = String(request.body.password || '');
    if (!email || password.length < 1 || password.length > 128) return response.status(400).json({ error: 'Enter your admin email and password.' });
    const admin = await Admin.findOne({ email, active: true }).select('+passwordHash');
    const valid = admin && await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return response.status(401).json({ error: 'Email or password is incorrect.' });
    await new Promise((resolve, reject) => request.session.regenerate(error => error ? reject(error) : resolve()));
    request.session.admin = safeAdmin(admin);
    request.session.authenticatedAt = Date.now();
    createCsrfToken(request.session);
    request.session.cookie.maxAge = 8 * 60 * 60 * 1000;
    admin.lastLoginAt = new Date();
    await admin.save();
    await logActivity(admin, 'login', 'admin', admin._id, 'Admin signed in');
    response.json({ admin: safeAdmin(admin), csrfToken: request.session.csrfToken });
  } catch (error) { next(error); }
});

router.get('/me', (request, response) => response.json({ admin: request.session?.admin || null, databaseConnected: require('mongoose').connection.readyState === 1 }));

router.post('/logout', requireAdmin, async (request, response, next) => {
  try {
    const rawFrontendUrl = String(process.env.FRONTEND_URL || '').trim();
    const isCrossSiteFrontend = Boolean(rawFrontendUrl) && !rawFrontendUrl.includes('localhost');
    const sessionCookieSameSite = String(process.env.SESSION_COOKIE_SAME_SITE || (isCrossSiteFrontend ? 'none' : 'strict')).toLowerCase();
    const cookieOptions = {
      httpOnly: true,
      sameSite: sessionCookieSameSite === 'lax' || sessionCookieSameSite === 'strict' || sessionCookieSameSite === 'none' ? sessionCookieSameSite : (isCrossSiteFrontend ? 'none' : 'strict'),
      secure: process.env.NODE_ENV === 'production' || process.env.SESSION_COOKIE_SECURE === 'true',
      path: '/'
    };
    request.session.destroy(error => {
      if (error) return next(error);
      response.clearCookie('bm.admin.sid', cookieOptions);
      response.status(204).end();
    });
  } catch (error) { next(error); }
});

router.use(requireAdmin);

router.get('/dashboard', requireDatabase, async (request, response, next) => {
  try {
    const [total, published, drafts, orders, pending, confirmed, delivered, categoryCount, recentOrders, activities, settings] = await Promise.all([
      Product.countDocuments(), Product.countDocuments({ $or: [{ status: 'published' }, { status: { $exists: false } }] }), Product.countDocuments({ status: 'draft' }),
      Order.countDocuments(), Order.countDocuments({ status: 'request-recorded' }), Order.countDocuments({ status: 'confirmed' }), Order.countDocuments({ status: 'delivered' }),
      Category.countDocuments({ published: true }), Order.find().sort({ createdAt: -1 }).limit(6).select('reference customer.name product.name status createdAt').lean(),
      Activity.find().sort({ createdAt: -1 }).limit(8).select('actorEmail action summary createdAt').lean(), SiteSettings.findOne({ key: 'main' }).lean()
    ]);
    response.json({ stats: { products: total, published, drafts, orders, pending, confirmed, delivered, categories: categoryCount }, recentOrders, activities, status: { database: 'connected', storage: storageStatus(), whatsappConfigured: Boolean((settings?.data?.whatsapp?.enabled && configuredWhatsAppNumber(settings.data.whatsapp.number)) || configuredWhatsAppNumber()), website: 'online' } });
  } catch (error) { next(error); }
});

router.get('/products', requireDatabase, async (request, response, next) => {
  try {
    const page = Math.max(1, Math.min(100000, Number(request.query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(request.query.limit) || 20));
    const filter = {};
    if (request.query.status === 'draft') filter.status = 'draft';
    if (request.query.status === 'published') filter.$or = [{ status: 'published' }, { status: { $exists: false } }];
    if (request.query.category) filter.category = cleanText(request.query.category, 40);
    if (request.query.search) {
      const term = cleanText(request.query.search, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [...(filter.$and || []), { $or: ['name', 'brand', 'slug', 'sku'].map(key => ({ [key]: { $regex: term, $options: 'i' } })) }];
    }
    const sortMap = { name: { name: 1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, price: { price: 1 } };
    const [products, total] = await Promise.all([Product.find(filter).sort(sortMap[request.query.sort] || { updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)]);
    response.json({ products, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.get('/products/:id([a-fA-F0-9]{24})', requireDatabase, async (request, response, next) => {
  try {
    const product = await Product.findById(request.params.id).lean();
    if (!product) return response.status(404).json({ error: 'Product not found.' });
    response.json({ product });
  } catch (error) { next(error); }
});

router.post('/products', requireDatabase, async (request, response, next) => {
  try {
    const validation = await validateProduct(request.body);
    if (validation.error) return response.status(400).json({ error: validation.error });
    const product = await Product.create(validation.product);
    await logActivity(request.session.admin, 'product.create', 'product', product._id, `Created ${product.name}`);
    response.status(201).json({ product });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That product slug is already in use.' }); next(error); }
});

router.put('/products/:id', requireDatabase, async (request, response, next) => {
  try {
    const validation = await validateProduct(request.body);
    if (validation.error) return response.status(400).json({ error: validation.error });
    const product = await Product.findByIdAndUpdate(request.params.id, validation.product, { new: true, runValidators: true });
    if (!product) return response.status(404).json({ error: 'Product not found.' });
    await logActivity(request.session.admin, 'product.update', 'product', product._id, `Updated ${product.name}`);
    response.json({ product });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That product slug is already in use.' }); next(error); }
});

router.post('/products/:id/duplicate', requireDatabase, async (request, response, next) => {
  try {
    const source = await Product.findById(request.params.id).lean();
    if (!source) return response.status(404).json({ error: 'Product not found.' });
    delete source._id; delete source.createdAt; delete source.updatedAt; delete source.__v;
    source.slug = `${source.slug}-copy-${crypto.randomBytes(3).toString('hex')}`;
    source.sku = '';
    source.status = 'draft'; source.active = false; source.featured = false;
    const product = await Product.create(source);
    await logActivity(request.session.admin, 'product.duplicate', 'product', product._id, `Duplicated ${product.name} as a draft`);
    response.status(201).json({ product });
  } catch (error) { next(error); }
});

router.delete('/products/:id', requireDatabase, async (request, response, next) => {
  try {
    const product = await Product.findByIdAndDelete(request.params.id);
    if (!product) return response.status(404).json({ error: 'Product not found.' });
    await logActivity(request.session.admin, 'product.delete', 'product', product._id, `Deleted ${product.name}`);
    response.status(204).end();
  } catch (error) { next(error); }
});

router.post('/products/bulk', requireDatabase, async (request, response, next) => {
  try {
    const ids = Array.isArray(request.body.ids) ? request.body.ids.filter(id => /^[a-f\d]{24}$/i.test(id)).slice(0, 100) : [];
    const action = request.body.action;
    if (!ids.length || !['publish', 'draft', 'delete'].includes(action)) return response.status(400).json({ error: 'Choose products and a supported bulk action.' });
    const result = action === 'delete'
      ? await Product.deleteMany({ _id: { $in: ids } })
      : await Product.updateMany({ _id: { $in: ids } }, { $set: { status: action === 'publish' ? 'published' : 'draft', active: action === 'publish' } });
    await logActivity(request.session.admin, `product.bulk.${action}`, 'product', '', `${action} action applied to ${result.deletedCount ?? result.modifiedCount} products`);
    response.json({ changed: result.deletedCount ?? result.modifiedCount });
  } catch (error) { next(error); }
});

router.get('/categories', requireDatabase, async (request, response, next) => {
  try { response.json({ categories: await Category.find().sort({ sortOrder: 1, name: 1 }).lean(), brands: await Brand.find().sort({ name: 1 }).lean() }); }
  catch (error) { next(error); }
});

function requireOwner(request, response, next) {
  if (request.session.admin.role === 'owner') return next();
  response.status(403).json({ error: 'Only the store owner can manage administrator accounts.' });
}

router.post('/categories', requireDatabase, async (request, response, next) => {
  try {
    const name = cleanText(request.body.name, 100); const slug = makeSlug(request.body.slug || name);
    if (name.length < 2 || !slug) return response.status(400).json({ error: 'Enter a category name.' });
    const category = await Category.create({ name, slug, description: cleanText(request.body.description, 1000), image: cleanText(request.body.image, 500) || null, sortOrder: Math.max(0, Number(request.body.sortOrder) || 0), published: request.body.published !== false });
    await logActivity(request.session.admin, 'category.create', 'category', category._id, `Created ${category.name}`);
    response.status(201).json({ category });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That category slug already exists.' }); next(error); }
});

router.put('/categories/:id', requireDatabase, async (request, response, next) => {
  try {
    const name = cleanText(request.body.name, 100); const slug = makeSlug(request.body.slug || name);
    const category = await Category.findByIdAndUpdate(request.params.id, { name, slug, description: cleanText(request.body.description, 1000), image: cleanText(request.body.image, 500) || null, sortOrder: Math.max(0, Number(request.body.sortOrder) || 0), published: request.body.published !== false }, { new: true, runValidators: true });
    if (!category) return response.status(404).json({ error: 'Category not found.' });
    await logActivity(request.session.admin, 'category.update', 'category', category._id, `Updated ${category.name}`);
    response.json({ category });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That category slug already exists.' }); next(error); }
});

router.delete('/categories/:id', requireDatabase, async (request, response, next) => {
  try {
    const category = await Category.findById(request.params.id);
    if (!category) return response.status(404).json({ error: 'Category not found.' });
    const usage = await Product.countDocuments({ category: category.slug });
    if (usage && !request.body.reassignTo) return response.status(409).json({ error: `This category is assigned to ${usage} products. Select a replacement category first.`, productsUsing: usage });
    if (usage) await Product.updateMany({ category: category.slug }, { $set: { category: cleanText(request.body.reassignTo, 40) } });
    await category.deleteOne();
    await logActivity(request.session.admin, 'category.delete', 'category', category._id, `Deleted ${category.name}`);
    response.status(204).end();
  } catch (error) { next(error); }
});

router.post('/brands', requireDatabase, async (request, response, next) => {
  try {
    const name = cleanText(request.body.name, 100); const slug = makeSlug(request.body.slug || name);
    if (!name || !slug) return response.status(400).json({ error: 'Enter a brand name.' });
    const brand = await Brand.create({ name, slug, logo: cleanText(request.body.logo, 500) || null, published: request.body.published !== false });
    await logActivity(request.session.admin, 'brand.create', 'brand', brand._id, `Created ${brand.name}`);
    response.status(201).json({ brand });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That brand already exists.' }); next(error); }
});

router.put('/brands/:id', requireDatabase, async (request, response, next) => {
  try {
    const name = cleanText(request.body.name, 100); const slug = makeSlug(request.body.slug || name);
    const brand = await Brand.findByIdAndUpdate(request.params.id, { name, slug, logo: cleanText(request.body.logo, 500) || null, published: request.body.published !== false }, { new: true, runValidators: true });
    if (!brand) return response.status(404).json({ error: 'Brand not found.' });
    await logActivity(request.session.admin, 'brand.update', 'brand', brand._id, `Updated ${brand.name}`);
    response.json({ brand });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That brand already exists.' }); next(error); }
});

router.delete('/brands/:id', requireDatabase, async (request, response, next) => {
  try {
    const brand = await Brand.findById(request.params.id);
    if (!brand) return response.status(404).json({ error: 'Brand not found.' });
    const usage = await Product.countDocuments({ brand: brand.name });
    if (usage) return response.status(409).json({ error: `This brand is assigned to ${usage} products and cannot be deleted.`, productsUsing: usage });
    await brand.deleteOne();
    await logActivity(request.session.admin, 'brand.delete', 'brand', brand._id, `Deleted ${brand.name}`);
    response.status(204).end();
  } catch (error) { next(error); }
});

router.get('/media', requireDatabase, async (request, response, next) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1); const limit = Math.min(60, Math.max(1, Number(request.query.limit) || 24));
    const query = cleanText(request.query.search, 100);
    const filter = query ? { $or: [{ filename: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { title: { $regex: query, $options: 'i' } }] } : {};
    const [media, total] = await Promise.all([Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Media.countDocuments(filter)]);
    response.json({ media, page, limit, total, pages: Math.ceil(total / limit), storage: storageStatus() });
  } catch (error) { next(error); }
});

router.post('/media', requireDatabase, upload.array('images', 10), async (request, response, next) => {
  const created = [];
  try {
    if (!request.files?.length) return response.status(400).json({ error: 'Choose at least one image.' });
    for (const file of request.files) {
      const dimensions = imageSize(file.buffer);
      const extension = String(dimensions.type || '').toLowerCase();
      const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
      if (!allowedImages.has(extension) || file.mimetype !== mimeType || dimensions.width < 1 || dimensions.height < 1) return response.status(415).json({ error: `${file.originalname} is not a supported, valid JPEG, PNG, WebP, or AVIF image.` });
      if (dimensions.width > 12000 || dimensions.height > 12000) return response.status(413).json({ error: 'Image dimensions exceed the 12,000 pixel limit.' });
      const stored = await putImage(file.buffer, mimeType);
      try {
        const media = await Media.create({ ...stored, filename: cleanText(path.basename(file.originalname), 180), mimeType, size: file.size, width: dimensions.width, height: dimensions.height, alt: cleanText(request.body.alt, 240), title: path.parse(file.originalname).name.slice(0, 180), uploadedBy: request.session.admin.id });
        created.push(media);
      } catch (error) {
        try { await deleteImage({ ...stored }); } catch (cleanupError) { console.error('Upload cleanup failed:', cleanupError.message); }
        throw error;
      }
    }
    await logActivity(request.session.admin, 'media.upload', 'media', '', `Uploaded ${created.length} image${created.length === 1 ? '' : 's'}`);
    response.status(201).json({ media: created });
  } catch (error) { next(error); }
});

router.put('/media/:id', requireDatabase, async (request, response, next) => {
  try {
    const media = await Media.findByIdAndUpdate(request.params.id, { alt: cleanText(request.body.alt, 240), title: cleanText(request.body.title, 180) }, { new: true, runValidators: true });
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    await logActivity(request.session.admin, 'media.update', 'media', media._id, `Updated media metadata for ${media.filename}`);
    response.json({ media });
  } catch (error) { next(error); }
});

router.put('/media/:id/file', requireDatabase, upload.single('image'), async (request, response, next) => {
  let replacement;
  let previous;
  let changedProductImages = false;
  let changedProductGallery = false;
  let settingsDocument;
  let previousSettingsData;
  try {
    if (!request.file) return response.status(400).json({ error: 'Choose a replacement image.' });
    const dimensions = imageSize(request.file.buffer);
    const extension = String(dimensions.type || '').toLowerCase();
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    if (!allowedImages.has(extension) || request.file.mimetype !== mimeType || dimensions.width < 1 || dimensions.height < 1) return response.status(415).json({ error: 'Choose a valid JPEG, PNG, WebP, or AVIF image.' });
    if (dimensions.width > 12000 || dimensions.height > 12000) return response.status(413).json({ error: 'Image dimensions exceed the 12,000 pixel limit.' });
    const existing = await Media.findById(request.params.id);
    if (!existing) return response.status(404).json({ error: 'Media not found.' });
    replacement = await putImage(request.file.buffer, mimeType);
    previous = { key: existing.key, url: existing.url, storage: existing.storage };
    settingsDocument = await SiteSettings.findOne({ key: 'main' });
    previousSettingsData = settingsDocument?.data;
    const directImages = await Product.updateMany({ image: previous.url }, { $set: { image: replacement.url } });
    changedProductImages = directImages.modifiedCount > 0;
    const galleryImages = await Product.updateMany({ 'gallery.url': previous.url }, { $set: { 'gallery.$[image].url': replacement.url } }, { arrayFilters: [{ 'image.url': previous.url }] });
    changedProductGallery = galleryImages.modifiedCount > 0;
    if (settingsDocument) {
      const replaceUrl = value => {
        if (value === previous.url) return replacement.url;
        if (Array.isArray(value)) return value.map(replaceUrl);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceUrl(item)]));
        return value;
      };
      settingsDocument.data = replaceUrl(settingsDocument.data);
      await settingsDocument.save();
    }
    Object.assign(existing, replacement, { filename: cleanText(path.basename(request.file.originalname), 180), mimeType, size: request.file.size, width: dimensions.width, height: dimensions.height });
    await existing.save();
    try { await deleteImage(previous); }
    catch (storageError) { console.error(`Replaced media left an old orphan ${previous.key}: ${storageError.message}`); }
    await logActivity(request.session.admin, 'media.replace', 'media', existing._id, `Replaced ${existing.filename}`);
    response.json({ media: existing });
  } catch (error) {
    if (previous && replacement) {
      try {
        if (changedProductImages) await Product.updateMany({ image: replacement.url }, { $set: { image: previous.url } });
        if (changedProductGallery) await Product.updateMany({ 'gallery.url': replacement.url }, { $set: { 'gallery.$[image].url': previous.url } }, { arrayFilters: [{ 'image.url': replacement.url }] });
        if (settingsDocument && previousSettingsData !== undefined) { settingsDocument.data = previousSettingsData; await settingsDocument.save(); }
      } catch (rollbackError) { console.error(`Media replacement database rollback failed: ${rollbackError.message}`); }
    }
    if (replacement) try { await deleteImage(replacement); } catch (cleanupError) { console.error('Replacement cleanup failed:', cleanupError.message); }
    next(error);
  }
});

router.delete('/media/:id', requireDatabase, async (request, response, next) => {
  try {
    const media = await Media.findById(request.params.id);
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    const settings = await SiteSettings.findOne({ key: 'main' }).lean();
    const references = await Product.countDocuments({ $or: [{ image: media.url }, { 'gallery.url': media.url }] });
    const settingsText = JSON.stringify(settings?.data || {});
    if (references || settingsText.includes(media.url)) return response.status(409).json({ error: 'This image is in use. Remove its references from products or site content before deleting it.', inUse: true });
    await media.deleteOne();
    try {
      await deleteImage(media);
    } catch (storageError) {
      console.error(`Media object ${media.key} is orphaned after metadata deletion: ${storageError.message}`);
      await logActivity(request.session.admin, 'media.delete', 'media', media._id, `Removed metadata for ${media.filename}; storage cleanup needs attention`);
      return response.status(202).json({ warning: 'Media metadata was removed, but the storage object could not be deleted. Check storage configuration for orphan cleanup.' });
    }
    await logActivity(request.session.admin, 'media.delete', 'media', media._id, `Deleted ${media.filename}`);
    response.status(204).end();
  } catch (error) { next(error); }
});

router.get('/settings', requireDatabase, async (request, response, next) => {
  try {
    const settings = await SiteSettings.findOne({ key: 'main' }).lean();
    response.json({ settings: settings?.data || {}, storage: storageStatus(), whatsappConfigured: Boolean(configuredWhatsAppNumber(settings?.data?.whatsapp?.number) || configuredWhatsAppNumber()) });
  } catch (error) { next(error); }
});

router.put('/settings', requireDatabase, async (request, response, next) => {
  try {
    const current = await SiteSettings.findOne({ key: 'main' }) || new SiteSettings({ key: 'main', data: {} });
    const incoming = request.body.settings || {};
    const allowedTop = ['site', 'homepage', 'branding', 'navigation', 'footer', 'seo', 'whatsapp'];
    const data = current.data?.toObject ? current.data.toObject() : { ...(current.data || {}) };
    for (const key of allowedTop) if (incoming[key] && typeof incoming[key] === 'object' && !Array.isArray(incoming[key])) data[key] = incoming[key];
    if (data.whatsapp?.enabled && !configuredWhatsAppNumber(data.whatsapp.number)) return response.status(400).json({ error: 'WhatsApp can only be enabled after a valid complete number is entered.' });
    data.site = { currency: 'USD', ...(data.site || {}) };
    current.data = data;
    current.updatedBy = request.session.admin.id;
    await current.save();
    await logActivity(request.session.admin, 'settings.update', 'settings', current._id, 'Updated website settings');
    response.json({ settings: current.data, whatsappConfigured: Boolean(configuredWhatsAppNumber(data.whatsapp?.number) || configuredWhatsAppNumber()) });
  } catch (error) { next(error); }
});

router.get('/orders', requireDatabase, async (request, response, next) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const filter = {};
    if (statusValues.includes(request.query.status)) filter.status = request.query.status;
    if (request.query.search) {
      const escaped = cleanText(request.query.search, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ reference: { $regex: escaped, $options: 'i' } }, { 'customer.name': { $regex: escaped, $options: 'i' } }, { 'product.name': { $regex: escaped, $options: 'i' } }];
    }
    const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(filter)]);
    response.json({ orders, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.get('/orders/:id([a-fA-F0-9]{24})', requireDatabase, async (request, response, next) => {
  try {
    const order = await Order.findById(request.params.id).lean();
    if (!order) return response.status(404).json({ error: 'Order request not found.' });
    response.json({ order });
  } catch (error) { next(error); }
});

router.put('/orders/:id', requireDatabase, async (request, response, next) => {
  try {
    if (!statusValues.includes(request.body.status)) return response.status(400).json({ error: 'Choose a valid order status.' });
    const order = await Order.findById(request.params.id);
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    const previous = order.status;
    order.status = request.body.status;
    order.adminNotes = cleanText(request.body.adminNotes, 3000);
    order.shippingInfo = cleanText(request.body.shippingInfo, 1000);
    order.cancelReason = cleanText(request.body.cancelReason, 500);
    if (request.body.confirmedPrice !== '' && request.body.confirmedPrice != null) {
      const price = Number(request.body.confirmedPrice);
      if (!Number.isFinite(price) || price < 0) return response.status(400).json({ error: 'Confirmed price must be a non-negative amount.' });
      order.confirmedPrice = price;
    }
    if (previous !== order.status) order.history.push({ status: order.status, note: order.cancelReason || '', changedBy: request.session.admin.id });
    await order.save();
    await logActivity(request.session.admin, 'order.update', 'order', order._id, `Changed ${order.reference} from ${previous} to ${order.status}`);
    response.json({ order });
  } catch (error) { next(error); }
});

router.delete('/orders/:id([a-fA-F0-9]{24})', requireDatabase, async (request, response, next) => {
  try {
    const order = await Order.findById(request.params.id);
    if (!order) return response.status(404).json({ error: 'Order request not found.' });
    await order.deleteOne();
    await logActivity(request.session.admin, 'order.delete', 'order', order._id, `Deleted order ${order.reference}`);
    response.status(204).end();
  } catch (error) { next(error); }
});

router.get('/orders.csv', requireDatabase, async (request, response, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(10000).lean();
    const csvCell = value => {
      let safeValue = String(value ?? '');
      if (/^[\s]*[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const rows = [['Reference', 'Created', 'Status', 'Customer', 'Phone', 'Email', 'Product', 'Quantity', 'Confirmed USD'], ...orders.map(order => [order.reference, order.createdAt?.toISOString(), order.status, order.customer.name, order.customer.phone, order.customer.email, order.product.name, order.product.quantity, order.confirmedPrice])];
    response.type('text/csv').attachment('bowlersmechanic-orders.csv').send(rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) { next(error); }
});

router.put('/password', async (request, response, next) => {
  try {
    const currentPassword = String(request.body.currentPassword || '');
    const newPassword = String(request.body.newPassword || '');
    if (newPassword.length < 12 || newPassword.length > 128) return response.status(400).json({ error: 'New password must be 12–128 characters.' });
    const admin = await Admin.findById(request.session.admin.id).select('+passwordHash');
    if (!admin || !await bcrypt.compare(currentPassword, admin.passwordHash)) return response.status(400).json({ error: 'Current password is incorrect.' });
    admin.passwordHash = await bcrypt.hash(newPassword, 12); admin.passwordChangedAt = new Date(); await admin.save();
    request.session.authenticatedAt = Date.now();
    await logActivity(admin, 'password.change', 'admin', admin._id, 'Changed account password');
    response.json({ message: 'Password updated.' });
  } catch (error) { next(error); }
});

router.get('/admins', requireOwner, async (request, response, next) => {
  try { response.json({ admins: await Admin.find().select('email name role active lastLoginAt createdAt').sort({ createdAt: 1 }).lean() }); }
  catch (error) { next(error); }
});

router.post('/admins', requireOwner, async (request, response, next) => {
  try {
    const email = cleanText(request.body.email, 254).toLowerCase(); const name = cleanText(request.body.name, 100); const password = String(request.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || password.length < 12 || password.length > 128) return response.status(400).json({ error: 'Enter a valid email, name, and password of at least 12 characters.' });
    const admin = await Admin.create({ email, name, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    await logActivity(request.session.admin, 'admin.create', 'admin', admin._id, `Created admin ${admin.email}`);
    response.status(201).json({ admin: safeAdmin(admin) });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'That admin email already exists.' }); next(error); }
});

router.put('/admins/:id', requireOwner, async (request, response, next) => {
  try {
    if (request.params.id === request.session.admin.id && request.body.active === false) return response.status(400).json({ error: 'You cannot deactivate your own account.' });
    const admin = await Admin.findById(request.params.id);
    if (!admin) return response.status(404).json({ error: 'Admin not found.' });
    if (request.body.name !== undefined) admin.name = cleanText(request.body.name, 100);
    if (request.body.active !== undefined) admin.active = Boolean(request.body.active);
    if (request.body.password) {
      const password = String(request.body.password);
      if (password.length < 12 || password.length > 128) return response.status(400).json({ error: 'Password must be 12–128 characters.' });
      admin.passwordHash = await bcrypt.hash(password, 12); admin.passwordChangedAt = new Date();
    }
    await admin.save();
    await logActivity(request.session.admin, 'admin.update', 'admin', admin._id, `Updated admin ${admin.email}`);
    response.json({ admin: safeAdmin(admin) });
  } catch (error) { next(error); }
});

module.exports = router;