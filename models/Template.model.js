const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    // Basic Info
    title: { type: String, required: true },
    description: { type: String, required: true },
    instruction: { type: String },
    caption: { type: String },
    tags: [{ type: String }],

    // Template Type
    contentType: {
        type: String,
        enum: ['Post', 'Carousel', 'Reel', 'Story'],
        required: true
    },

    // Canva Integration
    canvaTemplateId: { type: String, unique: true }, // Made optional for new approach
    canvaTemplateUrl: { type: String }, // Share URL from Canva
    canvaEditUrl: { type: String },

    // Template Preview
    thumbnailUrl: { type: String },
    previewImages: [{ type: String }],

    // Publishing Status
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },

    // Analytics
    viewCount: { type: Number, default: 0 },
    editCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },

    // Trending Logic
    trendingScore: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false },

    // Admin Info
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Calculate trending score
templateSchema.pre('save', function (next) {
    const daysSinceCreated = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0, 30 - daysSinceCreated) / 30;

    this.trendingScore = (
        this.editCount * 0.5 +
        this.bookmarkCount * 0.3 +
        this.viewCount * 0.2
    ) * recencyWeight;

    this.isTrending = this.trendingScore > 15;
    next();
});

module.exports = mongoose.model('Template', templateSchema);