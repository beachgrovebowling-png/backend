const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWhatsAppMessage, configuredWhatsAppNumber, validateOrder } = require('../src/order');

test('WhatsApp number rejects the incomplete +1 and accepts a complete international number', () => {
  assert.equal(configuredWhatsAppNumber('+1'), null);
  assert.equal(configuredWhatsAppNumber(''), null);
  assert.equal(configuredWhatsAppNumber('+1 202-555-0142'), null);
  assert.equal(configuredWhatsAppNumber('+1 (415) 867-5309'), '14158675309');
});

test('order validation requires a listed product and valid customer details', () => {
  const products = [{ slug: 'venom-shock', name: 'Venom Shock', brand: 'Motiv', price: null }];
  const body = { customerName: 'Alex Rider', customerPhone: '+1 202 555 0142', productId: 'venom-shock', quantity: '2', paymentMethod: 'Zelle' };
  const result = validateOrder(body, products);
  assert.equal(result.error, undefined);
  assert.equal(result.order.quantity, 2);
  assert.equal(validateOrder({ ...body, quantity: '0' }, products).error, 'Choose a quantity from 1 to 50.');
  assert.match(validateOrder({ ...body, productId: 'missing' }, products).error, /no longer available/);
});

test('order validation accepts only listed payment methods and includes preference in WhatsApp message', () => {
  const products = [{ slug: 'venom-shock', name: 'Venom Shock', brand: 'Motiv', price: null }];
  const body = { customerName: 'Alex Rider', customerPhone: '+1 202 555 0142', productId: 'venom-shock', quantity: '1', paymentMethod: 'Apple Pay' };
  const result = validateOrder(body, products);
  assert.equal(result.order.paymentMethod, 'Apple Pay');
  assert.match(buildWhatsAppMessage(result.order), /Preferred payment method: Apple Pay/);
  assert.match(validateOrder({ ...body, paymentMethod: '' }, products).error, /supported payment method/);
  assert.match(validateOrder({ ...body, paymentMethod: 'Bitcoin' }, products).error, /supported payment method/);
});

test('WhatsApp message uses contact-for-price wording and no confirmation claim', () => {
  const message = buildWhatsAppMessage({
    customerName: 'Alex Rider', customerPhone: '2025550142', email: '', quantity: 1, requirements: '',
    product: { brand: 'Motiv', name: 'Venom Shock', price: null }
  });
  assert.match(message, /Price: Contact for price/);
  assert.match(message, /not an order confirmation/);
  assert.doesNotMatch(message, /\$0\.00/);
});

test('HTTP endpoints expose readiness only and refuse incomplete WhatsApp redirects', async () => {
  const previousNumber = process.env.WHATSAPP_NUMBER;
  process.env.WHATSAPP_NUMBER = '+1';
  const { app } = require('../server');
  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const catalogueResponse = await fetch(`${baseUrl}/api/products`);
    const catalogue = await catalogueResponse.json();
    assert.equal(catalogueResponse.status, 503);
    assert.match(catalogueResponse.headers.get('cache-control'), /no-store/);
    assert.match(catalogue.error, /database is not connected/);
    assert.equal(Object.hasOwn(catalogue, 'products'), false);

    const orderResponse = await fetch(`${baseUrl}/api/orders/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customerName: 'Alex Rider', customerPhone: '2025550142', productId: 'motiv-venom-shock', quantity: '1' }),
      redirect: 'manual'
    });
    assert.equal(orderResponse.status, 503);
    assert.equal(orderResponse.headers.get('location'), null);
    assert.match(await orderResponse.text(), /complete international number/);

    process.env.WHATSAPP_NUMBER = '+1 415 867 5309';
    const configuredResponse = await fetch(`${baseUrl}/api/orders/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customerName: 'Alex Rider', customerPhone: '2025550142', productId: 'motiv-venom-shock', quantity: '1' }),
      redirect: 'manual'
    });
    assert.equal(configuredResponse.status, 503);
    assert.equal(configuredResponse.headers.get('location'), null);
    assert.match(await configuredResponse.text(), /request was not recorded/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previousNumber === undefined) delete process.env.WHATSAPP_NUMBER;
    else process.env.WHATSAPP_NUMBER = previousNumber;
  }
});

test('order pricing uses the current confirmed database price and sale price', () => {
  const body = { customerName: 'Alex Rider', customerPhone: '+1 202 555 0142', productId: 'storm-ice-spare-ball', quantity: '2', paymentMethod: 'Zelle' };
  const products = [{ slug: 'storm-ice-spare-ball', name: 'Spare Ball', brand: 'Storm', price: 180, salePrice: 145, priceConfirmed: true }];
  assert.equal(validateOrder(body, products).order.product.price, 145);
  assert.equal(validateOrder(body, [{ ...products[0], salePrice: null }]).order.product.price, 180);
});