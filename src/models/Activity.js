const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  actorEmail: { type: String, required: true, maxlength: 254 },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, required: true, maxlength: 60 },
  targetId: { type: String, default: '', maxlength: 100 },
  summary: { type: String, required: true, maxlength: 240 }
}, { timestamps: true });

activitySchema.index({ createdAt: -1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);