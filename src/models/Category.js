const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  image: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  published: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);