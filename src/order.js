const PHONE_PATTERN = /^[+\d().\s-]{7,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_METHODS = new Set(['Zelle', 'Chime', 'Apple Pay', 'Cash App']);

function configuredWhatsAppNumber(value = process.env.WHATSAPP_NUMBER) {
  const digits = String(value || '').replace(/\D/g, '');
  const isFictionalNanpNumber = digits.length === 11
    && digits.startsWith('1')
    && digits.slice(4, 7) === '555'
    && /^01\d{2}$/.test(digits.slice(7));
  return digits.length >= 8 && digits.length <= 15 && digits[0] !== '0' && !isFictionalNanpNumber ? digits : null;
}

function stormIceOrderPrice(productSlug, quantity) {
  if (String(productSlug || '').toLowerCase() !== 'storm-ice-spare-ball') return null;
  if (Number(quantity) === 2) return 170;
  if (Number(quantity) === 1) return 100;
  return null;
}

function validateOrder(body, products) {
  const customerName = String(body.customerName || '').trim();
  const customerPhone = String(body.customerPhone || '').trim();
  const email = String(body.email || '').trim();
  const productId = String(body.productId || '').trim();
  const quantity = Number(body.quantity);
  const paymentMethod = String(body.paymentMethod || '').trim();
  const requirements = String(body.requirements || '').trim();

  if (customerName.length < 2 || customerName.length > 100) return { error: 'Enter your name (2 to 100 characters).' };
  if (!PHONE_PATTERN.test(customerPhone) || customerPhone.replace(/\D/g, '').length < 7) return { error: 'Enter a valid phone number.' };
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) return { error: 'Enter a valid email address, or leave it blank.' };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return { error: 'Choose a quantity from 1 to 50.' };
  if (!PAYMENT_METHODS.has(paymentMethod)) return { error: 'Choose a supported payment method.' };
  if (requirements.length > 500) return { error: 'Additional requirements must be 500 characters or fewer.' };

  const product = products.find(item => String(item._id || item.slug) === productId || item.slug === productId);
  if (!product) return { error: 'That product is no longer available. Refresh the catalogue and try again.' };

  const stormIcePrice = stormIceOrderPrice(product.slug, quantity);
  const resolvedPrice = stormIcePrice ?? (product.priceConfirmed === true && Number.isFinite(product.price) ? product.price : null);

  return {
    order: {
      customerName,
      customerPhone,
      email,
      quantity,
      paymentMethod,
      requirements,
      product: {
        name: product.name,
        brand: product.brand,
        price: resolvedPrice,
        slug: product.slug
      }
    }
  };
}

function buildWhatsAppMessage(order) {
  const price = Number.isFinite(order.product.price) ? `$${order.product.price.toFixed(2)} USD` : 'Contact for price';
  return [
    'BowlersMechanic order enquiry',
    '',
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    ...(order.email ? [`Email: ${order.email}`] : []),
    `Product: ${order.product.brand} ${order.product.name}`,
    `Price: ${price}`,
    `Quantity: ${order.quantity}`,
    ...(order.paymentMethod ? [`Preferred payment method: ${order.paymentMethod}`] : []),
    ...(order.requirements ? [`Additional requirements: ${order.requirements}`] : []),
    '',
    'Please confirm availability and final order details. This enquiry is not an order confirmation.',
    'Unconfirmed prices and shipping costs must be confirmed by the owner before the order is finalised.'
  ].join('\n');
}

module.exports = { buildWhatsAppMessage, configuredWhatsAppNumber, validateOrder };