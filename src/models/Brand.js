const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  logo: { type: String, default: null },
  published: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);