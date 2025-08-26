const mongoose = require('mongoose');

const contentItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    imageUrl: [{ type: String }],
    videoUrl: [{ type: String }],
    description: { type: String },
    instruction: { type: String },
    caption: { type: String },
    contentType: { type: String, enum: ['Reel', 'Post', 'Carousel', 'Story'] },
    categories: [{ type: String }],
    tags: [{ type: String }],

    // Canva Integration
    canvaTemplateId: { type: String },

    // Trending Logic
    usageCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false },

    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Calculate trending score before saving
contentItemSchema.pre('save', function (next) {
    // Simple trending algorithm
    const daysSinceCreated = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0, 30 - daysSinceCreated) / 30; // Newer content gets higher weight

    this.trendingScore = (this.usageCount * 0.4 + this.downloadCount * 0.4 + this.viewCount * 0.2) * recencyWeight;
    this.isTrending = this.trendingScore > 10; // Threshold for trending

    next();
});

module.exports = mongoose.model('ContentItem', contentItemSchema);