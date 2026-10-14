const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  brand: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  shortDescription: { type: String, default: '', trim: true, maxlength: 280 },
  fullDescription: { type: String, default: '', trim: true, maxlength: 8000 },
  sku: { type: String, default: '', trim: true, maxlength: 80 },
  image: { type: String, default: null, trim: true },
  imageAlt: { type: String, default: '', trim: true, maxlength: 240 },
  gallery: { type: [{ url: String, alt: { type: String, default: '' } }], default: [] },
  price: { type: Number, default: null, min: 0 },
  salePrice: { type: Number, default: null, min: 0 },
  priceConfirmed: { type: Boolean, default: false },
  stockQuantity: { type: Number, default: null, min: 0 },
  lowStockThreshold: { type: Number, default: null, min: 0 },
  condition: { type: String, default: 'unspecified', enum: ['unspecified', 'new', 'used', 'refurbished'] },
  specifications: { type: [{ name: String, value: String }], default: [] },
  weights: { type: [{ label: String, value: Number, available: Boolean }], default: [] },
  pricingRule: { type: String, default: 'contact', trim: true, maxlength: 80 },
  offers: { type: [{ id: String, label: String, price: Number, quantity: Number, active: Boolean }], default: [] },
  tags: { type: [String], default: [] },
  availability: { type: String, enum: ['available', 'out-of-stock', 'contact'], default: 'contact' },
  featured: { type: Boolean, default: false },
  isStarter: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  seoTitle: { type: String, default: '', maxlength: 180 },
  seoDescription: { type: String, default: '', maxlength: 320 }
}, { timestamps: true, strict: 'throw' });

productSchema.index({ status: 1, active: 1, category: 1, featured: -1 });
productSchema.index({ name: 'text', brand: 'text', sku: 'text', tags: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);