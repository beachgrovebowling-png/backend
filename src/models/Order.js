const mongoose = require('mongoose');

const statusValues = ['request-recorded', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const orderSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  customer: {
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 24 },
    email: { type: String, default: '', maxlength: 254 }
  },
  product: {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    sku: { type: String, default: '' },
    unitPrice: { type: Number, default: null },
    quantity: { type: Number, required: true, min: 1, max: 50 }
  },
  requirements: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: statusValues, default: 'request-recorded' },
  confirmedPrice: { type: Number, default: null, min: 0 },
  adminNotes: { type: String, default: '', maxlength: 3000 },
  shippingInfo: { type: String, default: '', maxlength: 1000 },
  cancelReason: { type: String, default: '', maxlength: 500 },
  history: [{ status: { type: String, enum: statusValues }, note: { type: String, default: '' }, changedAt: { type: Date, default: Date.now }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' } }]
}, { timestamps: true });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'customer.name': 1, reference: 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);