const mongoose = require('mongoose');

const canvaAccessRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // User details at time of request
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },

    // Request details
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING'],
        default: 'PENDING'
    },

    // Admin processing
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: { type: Date },
    adminNotes: { type: String },

    // Canva team details (after approval)
    canvaTeamMemberId: { type: String },
    canvaTeamRole: { type: String },

    // Request metadata
    requestReason: { type: String },
    businessType: { type: String },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
canvaAccessRequestSchema.index({ userId: 1 });
canvaAccessRequestSchema.index({ status: 1 });
canvaAccessRequestSchema.index({ createdAt: -1 });
canvaAccessRequestSchema.index({ processedBy: 1 });

// Update timestamp on save
canvaAccessRequestSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('CanvaAccessRequest', canvaAccessRequestSchema);
