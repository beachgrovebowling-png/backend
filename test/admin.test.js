require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Activity = require('../src/models/Activity');
const SiteSettings = require('../src/models/SiteSettings');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Media = require('../src/models/Media');
const Order = require('../src/models/Order');
const { app, connectDatabase } = require('../server');

function sessionCookie(response) {
  const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  return setCookies.map(cookie => cookie.split(';')[0]).join('; ');
}

test('admin authentication, CSRF, private dashboard, and logout use Mongo-backed sessions', async context => {
  if (!process.env.MONGODB_URI) return context.skip('MONGODB_URI is not configured.');
  const connected = await connectDatabase();
  if (!connected) return context.skip('MongoDB is unavailable.');

  const email = `cms-qa-${crypto.randomBytes(6).toString('hex')}@example.invalid`;
  const password = crypto.randomBytes(24).toString('base64url');
  const admin = await Admin.create({ email, name: 'Temporary CMS QA', role: 'owner', passwordHash: await bcrypt.hash(password, 12) });
  const categorySlug = `qa-${crypto.randomBytes(5).toString('hex')}`;
  let categoryId;
  let productId;
  let mediaId;
  let orderId;
  let independentOrderId;
  const previousSettings = await SiteSettings.findOne({ key: 'main' }).lean();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';

  try {
    const denied = await fetch(`${baseUrl}/api/admin/dashboard`);
    assert.equal(denied.status, 401);

    const csrfResponse = await fetch(`${baseUrl}/api/admin/csrf`);
    assert.equal(csrfResponse.status, 200);
    const csrfCookie = sessionCookie(csrfResponse);
    const csrfData = await csrfResponse.json();
    assert.ok(csrfData.csrfToken);

    const missingToken = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST', headers: { Cookie: csrfCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert.equal(missingToken.status, 403);

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST', headers: { Cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrfData.csrfToken },
      body: JSON.stringify({ email, password })
    });
    assert.equal(loginResponse.status, 200);
    cookie = sessionCookie(loginResponse);
    const login = await loginResponse.json();
    assert.equal(login.admin.role, 'owner');
    assert.equal(typeof login.csrfToken, 'string');

    const dashboardResponse = await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Cookie: cookie } });
    assert.equal(dashboardResponse.status, 200);
    const dashboard = await dashboardResponse.json();
    assert.ok(Number.isInteger(dashboard.stats.products));
    assert.ok(Number.isInteger(dashboard.stats.orders));

    const settingsResponse = await fetch(`${baseUrl}/api/admin/settings`, { headers: { Cookie: cookie } });
    assert.equal(settingsResponse.status, 200);
    const currentSettings = (await settingsResponse.json()).settings;
    const changedNumber = '14158675309';
    const saveSettingsResponse = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ settings: { ...currentSettings, whatsapp: { ...(currentSettings.whatsapp || {}), number: changedNumber, enabled: true } } })
    });
    assert.equal(saveSettingsResponse.status, 200);
    const savedSettings = await saveSettingsResponse.json();
    assert.equal(savedSettings.settings.whatsapp.number, changedNumber);
    assert.equal(savedSettings.whatsappConfigured, true);

    const privateProducts = await fetch(`${baseUrl}/api/admin/products?limit=5`, { headers: { Cookie: cookie } });
    assert.equal(privateProducts.status, 200);
    assert.ok(Array.isArray((await privateProducts.json()).products));

    const publicResponse = await fetch(`${baseUrl}/api/products`);
    const publicData = await publicResponse.json();
    assert.equal(publicResponse.status, 200);
    assert.ok(!JSON.stringify(publicData).includes(email));

    const settingsForOrder = await SiteSettings.findOne({ key: 'main' }) || new SiteSettings({ key: 'main', data: {} });
    settingsForOrder.data = { ...(settingsForOrder.data || {}), whatsapp: { enabled: false, number: '', referencePrefix: 'QATEST' }, site: { ...(settingsForOrder.data?.site || {}), contactEmail: 'shop@example.com' } };
    await settingsForOrder.save();
    const orderProduct = await Product.findOne({ active: true, $or: [{ status: 'published' }, { status: { $exists: false } }] }).lean();
    assert.ok(orderProduct, 'a published product must exist to test order recording');
    const savedOnlyResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerName: 'Temporary order-only customer', customerPhone: '4158675309', productId: String(orderProduct._id), quantity: '1', paymentMethod: 'Zelle' })
    });
    assert.equal(savedOnlyResponse.status, 201);
    const savedOnly = await savedOnlyResponse.json();
    assert.match(savedOnly.reference, /^QATEST-/);
    assert.equal(savedOnly.whatsappNumber, null);
    assert.equal(savedOnly.contactEmail, 'shop@example.com');
    const savedOnlyOrder = await Order.findOne({ reference: savedOnly.reference });
    assert.ok(savedOnlyOrder);
    assert.equal(savedOnlyOrder.status, 'request-recorded');
    independentOrderId = savedOnlyOrder._id;

    settingsForOrder.data.whatsapp = { enabled: true, number: '14158675309', referencePrefix: 'QATEST' };
    await settingsForOrder.save();
    const orderResponse = await fetch(`${baseUrl}/api/orders/whatsapp`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customerName: 'Temporary QA Customer', customerPhone: '4158675309', productId: String(orderProduct._id), quantity: '1', paymentMethod: 'Zelle' }),
      redirect: 'manual'
    });
    assert.equal(orderResponse.status, 303);
    assert.match(orderResponse.headers.get('location'), /^https:\/\/wa\.me\/14158675309\?text=/);
    const orderMessage = new URL(orderResponse.headers.get('location')).searchParams.get('text');
    const reference = orderMessage.match(/Order reference: (QATEST-[A-Z0-9-]+)/)?.[1];
    assert.ok(reference);
    const recordedOrder = await Order.findOne({ reference });
    assert.ok(recordedOrder);
    orderId = recordedOrder._id;
    assert.equal(recordedOrder.status, 'request-recorded');

    const csv = await fetch(`${baseUrl}/api/admin/orders.csv`, { headers: { Cookie: cookie } });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);

    const categoryResponse = await fetch(`${baseUrl}/api/admin/categories`, {
      method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ name: `QA ${categorySlug}`, slug: categorySlug, published: true })
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category._id;

    const productResponse = await fetch(`${baseUrl}/api/admin/products`, {
      method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Temporary CMS QA Product', brand: 'QA only', slug: `${categorySlug}-product`, category: categorySlug, shortDescription: 'Temporary test listing', price: null, availability: 'contact', stockQuantity: null, status: 'draft', active: false })
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product._id;
    let product = await Product.findById(productId).lean();
    assert.equal(product.status, 'draft');
    const hidden = await (await fetch(`${baseUrl}/api/products`)).json();
    assert.equal(hidden.products.some(item => item.slug === product.slug), false);

    const published = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
      method: 'PUT', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ ...product, _id: undefined, __v: undefined, createdAt: undefined, updatedAt: undefined, status: 'published', active: true })
    });
    assert.equal(published.status, 200);
    const visible = await (await fetch(`${baseUrl}/api/products`)).json();
    assert.equal(visible.products.some(item => item.slug === product.slug), true);

    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+XcAAAAASUVORK5CYII=', 'base64');
    const imageForm = new FormData(); imageForm.append('images', new Blob([imageBytes], { type: 'image/png' }), 'qa-media.png');
    const uploadResponse = await fetch(`${baseUrl}/api/admin/media`, { method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken }, body: imageForm });
    assert.equal(uploadResponse.status, 201, (await uploadResponse.clone().text()).slice(0, 300));
    let uploaded = (await uploadResponse.json()).media[0]; mediaId = uploaded._id;
    assert.equal(uploaded.width, 1);
    assert.equal((await fetch(new URL(uploaded.url, baseUrl))).status, 200);

    product = await Product.findById(productId).lean();
    const imageUse = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
      method: 'PUT', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ ...product, _id: undefined, __v: undefined, createdAt: undefined, updatedAt: undefined, image: uploaded.url, imageAlt: 'QA pixel' })
    });
    assert.equal(imageUse.status, 200);

    const oldUrl = uploaded.url;
    const replacementForm = new FormData(); replacementForm.append('image', new Blob([imageBytes], { type: 'image/png' }), 'qa-media-replaced.png');
    const replacementResponse = await fetch(`${baseUrl}/api/admin/media/${mediaId}/file`, { method: 'PUT', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken }, body: replacementForm });
    assert.equal(replacementResponse.status, 200, (await replacementResponse.clone().text()).slice(0, 300));
    uploaded = (await replacementResponse.json()).media;
    assert.notEqual(uploaded.url, oldUrl);
    assert.equal((await Product.findById(productId).lean()).image, uploaded.url);
    const protectedDelete = await fetch(`${baseUrl}/api/admin/media/${mediaId}`, { method: 'DELETE', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken } });
    assert.equal(protectedDelete.status, 409);

    const orderMissing = await fetch(`${baseUrl}/api/admin/orders/aaaaaaaaaaaaaaaaaaaaaaaa`, { headers: { Cookie: cookie } });
    assert.equal(orderMissing.status, 404);
    const deleteOrderResponse = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
      method: 'DELETE', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken }
    });
    assert.equal(deleteOrderResponse.status, 204);
    assert.equal(await Order.findById(orderId), null);
    const deletedOrderResponse = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, { headers: { Cookie: cookie } });
    assert.equal(deletedOrderResponse.status, 404);

    const logout = await fetch(`${baseUrl}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': login.csrfToken } });
    assert.equal(logout.status, 204);
    cookie = '';
    const expired = await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Cookie: sessionCookie(logout) } });
    assert.equal(expired.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (cookie) {
      try {
        const csrfResponse = await fetch(`${baseUrl}/api/admin/csrf`, { headers: { Cookie: cookie } });
        const csrfData = await csrfResponse.json();
        await fetch(`${baseUrl}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfData.csrfToken } });
      } catch {}
    }
    await Activity.deleteMany({ actorEmail: email });
    if (orderId) await Order.deleteOne({ _id: orderId });
    if (independentOrderId) await Order.deleteOne({ _id: independentOrderId });
    if (productId) await Product.deleteOne({ _id: productId });
    if (mediaId) {
      const media = await Media.findById(mediaId);
      if (media) { const { deleteImage } = require('../src/storage'); try { await deleteImage(media); } catch {} await media.deleteOne(); }
    }
    if (categoryId) await Category.deleteOne({ _id: categoryId });
    await Admin.deleteOne({ _id: admin._id });
    if (previousSettings) await SiteSettings.replaceOne({ key: 'main' }, previousSettings);
    await mongoose.disconnect();
  }
});
