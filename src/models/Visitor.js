const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, maxlength: 36 },
  page: { type: String, required: true, maxlength: 300 },
  device: { type: String, required: true, enum: ['mobile', 'tablet', 'desktop'] },
  browser: { type: String, required: true, maxlength: 40 },
  notificationStatus: { type: String, enum: ['pending', 'sent', 'failed', 'disabled'], default: 'pending' }
}, { timestamps: true });

visitorSchema.index({ sessionId: 1 }, { unique: true });
visitorSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
