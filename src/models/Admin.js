const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, enum: ['owner', 'admin'], default: 'admin' },
  active: { type: Boolean, default: true },
  passwordChangedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);