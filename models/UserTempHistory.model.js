const mongoose = require('mongoose');

const userTemplateHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },

    // Action Details
    action: {
        type: String,
        enum: ['viewed', 'edited', 'bookmarked', 'downloaded'],
        required: true
    },

    // Canva Design Info (for edits)
    canvaDesignId: { type: String },
    canvaDesignTitle: { type: String },
    canvaEditUrl: { type: String },

    // Edit Time Tracking
    editDuration: { type: Number, default: 0 }, // in seconds
    editStartTime: { type: Date },
    editEndTime: { type: Date },

    // Additional Data
    metadata: { type: mongoose.Schema.Types.Mixed },

    createdAt: { type: Date, default: Date.now }
});

// Index for faster queries
userTemplateHistorySchema.index({ userId: 1, templateId: 1 });
userTemplateHistorySchema.index({ userId: 1, action: 1 });

module.exports = mongoose.model('UserTemplateHistory', userTemplateHistorySchema);