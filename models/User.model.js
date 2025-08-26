const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
    businessType: { type: String },
    interests: [{ type: String }],
    profileImage: { type: String },
    stripeCustomerId: { type: String },

    // Email Verification
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpiry: { type: Date },

    // Canva Integration
    canvaAccessToken: { type: String },
    canvaRefreshToken: { type: String },
    canvaUserId: { type: String },
    canvaConnected: { type: Boolean, default: false },
    canvaTeamAccess: { type: Boolean, default: false },
    canvaTeamRole: { type: String },

    // NEW: Template Bookmarks (for new template system)

    templateBookmarks: {
        type: [{
            templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
            bookmarkedAt: { type: Date, default: Date.now }
        }],
        default: []
    },

    // EXISTING: Subscription Reference (keep your existing structure)
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

    // Legacy fields (keep for backward compatibility)
    templateHistory: [{
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
        canvaDesignId: { type: String },
        designTitle: { type: String },
        action: { type: String, enum: ['created', 'edited', 'downloaded'], default: 'created' },
        editTime: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],

    bookmarks: [{
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
        bookmarkedAt: { type: Date, default: Date.now }
    }],
    downloads: [{
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
        downloadedAt: { type: Date, default: Date.now }
    }],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);