const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true, minimize: false });

module.exports = mongoose.models.SiteSettings || mongoose.model('SiteSettings', siteSettingsSchema);