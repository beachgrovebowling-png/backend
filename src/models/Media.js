const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  filename: { type: String, required: true, maxlength: 180 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  alt: { type: String, default: '', maxlength: 240 },
  title: { type: String, default: '', maxlength: 180 },
  storage: { type: String, enum: ['local', 'r2'], required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

mediaSchema.index({ filename: 'text', title: 'text', alt: 'text' });

module.exports = mongoose.models.Media || mongoose.model('Media', mediaSchema);