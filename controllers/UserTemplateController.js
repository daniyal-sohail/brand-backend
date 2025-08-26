const asyncHandler = require('express-async-handler');
const { Template } = require('../models');
const { UserTemplateHistory } = require('../models');
const { User } = require('../models');
const { Plan } = require('../models');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

// Helper function to check user's template access based on existing subscription
const checkUserTemplateAccess = async (userId) => {
    const user = await User.findById(userId).populate('subscription');

    // Default limits for free users
    let templateLimit = 10;
    let isUnlimited = false;
    let planName = 'free';

    // Check if user has active subscription
    if (user?.subscription && user.subscription.status === 'active') {
        // Try to resolve the plan by slug or name (subscription.planName is stored as a string)
        const plan = await Plan.findOne({
            $or: [
                { slug: user.subscription.planName },
                { name: user.subscription.planName }
            ]
        });
        if (plan) {
            planName = plan.name || plan.slug;
            // Assuming premium/paid plans have unlimited access
            if (plan.slug !== 'free') {
                isUnlimited = true;
                templateLimit = -1; // Unlimited
            }
        } else {
            // Fallback: treat any non-"free" planName as paid
            if (user.subscription.planName && user.subscription.planName.toLowerCase() !== 'free') {
                isUnlimited = true;
                templateLimit = -1;
                planName = user.subscription.planName;
            }
        }
    }

    return {
        isUnlimited,
        templateLimit,
        planName,
        hasActiveSubscription: user?.subscription?.status === 'active'
    };
};

// Get published templates for users
exports.getPublishedTemplates = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        contentType,
        sortBy = 'newest',
        tags
    } = req.query;

    // Check user's access level
    const userAccess = await checkUserTemplateAccess(req.user._id);

    // Only show published templates
    const filter = { isPublished: true };

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
        ];
    }

    if (contentType) {
        filter.contentType = contentType;
    }

    if (tags) {
        const tagArray = tags.split(',');
        filter.tags = { $in: tagArray };
    }

    let sortOptions = {};
    switch (sortBy) {
        case 'newest':
            sortOptions = { publishedAt: -1 };
            break;
        case 'popular':
            sortOptions = { editCount: -1, bookmarkCount: -1 };
            break;
        case 'trending':
            sortOptions = { trendingScore: -1 };
            break;
        default:
            sortOptions = { publishedAt: -1 };
    }

    // Apply template limit for free users
    const queryLimit = userAccess.isUnlimited ? limit : Math.min(limit, userAccess.templateLimit);

    const templates = await Template.find(filter)
        .sort(sortOptions)
        .limit(queryLimit * 1)
        .skip((page - 1) * queryLimit)
        .select('-canvaTemplateId') // Hide internal Canva ID from users
        .lean();

    const total = await Template.countDocuments(filter);
    const limitedTotal = userAccess.isUnlimited ? total : Math.min(total, userAccess.templateLimit);

    res.json(new ApiResponse(200, {
        templates,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(limitedTotal / queryLimit),
            totalItems: limitedTotal,
            hasNextPage: page < Math.ceil(limitedTotal / queryLimit),
            hasPrevPage: page > 1
        },
        userLimits: {
            plan: userAccess.planName,
            templateLimit: userAccess.templateLimit,
            isUnlimited: userAccess.isUnlimited,
            hasActiveSubscription: userAccess.hasActiveSubscription
        }
    }, 'Templates fetched successfully'));
});

// Get single template details
exports.getTemplateDetails = asyncHandler(async (req, res) => {
    const template = await Template.findById(req.params.id)
        .select('-canvaTemplateId')
        .lean();

    // Check that template is published
    if (!template || !template.isPublished) {
        throw new ApiError(404, 'Template not found');
    }

    // Check user access
    const userAccess = await checkUserTemplateAccess(req.user._id);

    // For free users, check if they're within limit
    if (!userAccess.isUnlimited) {
        const userHistoryCount = await UserTemplateHistory.countDocuments({
            userId: req.user._id,
            action: 'viewed',
            createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // This month
            }
        });

        if (userHistoryCount >= userAccess.templateLimit) {
            throw new ApiError(403, 'Monthly template view limit reached. Upgrade to premium for unlimited access.');
        }
    }

    // Increment view count
    await Template.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    // Track user view
    await UserTemplateHistory.create({
        userId: req.user._id,
        templateId: req.params.id,
        action: 'viewed'
    });

    logger.info('Template viewed', { templateId: template._id, userId: req.user._id });
    res.json(new ApiResponse(200, template, 'Template details fetched'));
});

// Get Canva share URL (simple redirect)
exports.getCanvaShareUrl = asyncHandler(async (req, res) => {
    const template = await Template.findById(req.params.id);

    // Check that template is published
    if (!template || !template.isPublished) {
        throw new ApiError(404, 'Template not found');
    }

    // Check if template has a Canva share URL
    if (!template.canvaTemplateUrl) {
        throw new ApiError(404, 'Template share URL not available');
    }

    // Track the access action
    await UserTemplateHistory.create({
        userId: req.user._id,
        templateId: req.params.id,
        action: 'accessed_canva'
    });

    // Increment template access count
    await Template.findByIdAndUpdate(req.params.id, { $inc: { editCount: 1 } });

    logger.info('Template Canva URL accessed', { templateId: template._id, userId: req.user._id });

    res.json(new ApiResponse(200, {
        canvaUrl: template.canvaTemplateUrl,
        templateTitle: template.title
    }, 'Canva share URL retrieved successfully'));
});

// Bookmark functionality
exports.bookmarkTemplate = asyncHandler(async (req, res) => {
    const template = await Template.findById(req.params.id);

    // Check that template is published
    if (!template || !template.isPublished) {
        throw new ApiError(404, 'Template not found');
    }

    const user = await User.findById(req.user._id);

    // Check if already bookmarked
    const existingBookmark = user.templateBookmarks?.find(
        bookmark => bookmark.templateId.toString() === req.params.id
    );

    if (existingBookmark) {
        throw new ApiError(400, 'Template already bookmarked');
    }

    // Add bookmark
    await User.findByIdAndUpdate(req.user._id, {
        $push: {
            templateBookmarks: {
                templateId: req.params.id,
                bookmarkedAt: new Date()
            }
        }
    });

    // Track bookmark action
    await UserTemplateHistory.create({
        userId: req.user._id,
        templateId: req.params.id,
        action: 'bookmarked'
    });

    // Increment template bookmark count
    await Template.findByIdAndUpdate(req.params.id, { $inc: { bookmarkCount: 1 } });

    logger.info('Template bookmarked', { templateId: req.params.id, userId: req.user._id });
    res.json(new ApiResponse(200, null, 'Template bookmarked successfully'));
});

// Remove bookmark
exports.removeBookmark = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $pull: {
            templateBookmarks: { templateId: req.params.id }
        }
    });

    // Decrement template bookmark count
    await Template.findByIdAndUpdate(req.params.id, { $inc: { bookmarkCount: -1 } });

    logger.info('Template bookmark removed', { templateId: req.params.id, userId: req.user._id });
    res.json(new ApiResponse(200, null, 'Bookmark removed successfully'));
});

// Get user's bookmarked templates
exports.getUserBookmarks = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, contentType } = req.query;

    const user = await User.findById(req.user._id)
        .populate({
            path: 'templateBookmarks.templateId',
            match: {
                isPublished: true,
                ...(search && {
                    $or: [
                        { title: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ]
                }),
                ...(contentType && { contentType })
            },
            select: '-canvaTemplateId'
        })
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Filter out null templates (unpublished or deleted)
    const validBookmarks = user.templateBookmarks.filter(bookmark => bookmark.templateId);

    // Sort by bookmark date (newest first)
    validBookmarks.sort((a, b) => new Date(b.bookmarkedAt) - new Date(a.bookmarkedAt));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBookmarks = validBookmarks.slice(startIndex, endIndex);

    res.json(new ApiResponse(200, {
        bookmarks: paginatedBookmarks,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(validBookmarks.length / limit),
            totalItems: validBookmarks.length,
            hasNextPage: page < Math.ceil(validBookmarks.length / limit),
            hasPrevPage: page > 1
        }
    }, 'Bookmarks fetched successfully'));
});

// Get user's template history
exports.getUserTemplateHistory = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        action,
        sortBy = 'newest',
        search
    } = req.query;

    const filter = { userId: req.user._id };

    if (action) {
        filter.action = action;
    }

    let sortOptions = {};
    switch (sortBy) {
        case 'newest':
            sortOptions = { createdAt: -1 };
            break;
        case 'oldest':
            sortOptions = { createdAt: 1 };
            break;
        case 'action':
            sortOptions = { action: 1, createdAt: -1 };
            break;
        default:
            sortOptions = { createdAt: -1 };
    }

    const history = await UserTemplateHistory.find(filter)
        .populate({
            path: 'templateId',
            match: {
                ...(search && {
                    $or: [
                        { title: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ]
                })
            },
            select: 'title description contentType thumbnailUrl'
        })
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    // Filter out history items with deleted templates
    const validHistory = history.filter(item => item.templateId);

    const total = await UserTemplateHistory.countDocuments(filter);

    res.json(new ApiResponse(200, {
        history: validHistory,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        }
    }, 'Template history fetched successfully'));
});

// Get user's subscription status for templates
exports.getTemplateSubscriptionStatus = asyncHandler(async (req, res) => {
    const userAccess = await checkUserTemplateAccess(req.user._id);

    // Get current month's usage
    const currentMonthViews = await UserTemplateHistory.countDocuments({
        userId: req.user._id,
        action: 'viewed',
        createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
    });

    res.json(new ApiResponse(200, {
        plan: userAccess.planName,
        templateLimit: userAccess.templateLimit,
        isUnlimited: userAccess.isUnlimited,
        hasActiveSubscription: userAccess.hasActiveSubscription,
        currentMonthViews,
        remainingViews: userAccess.isUnlimited ? -1 : Math.max(0, userAccess.templateLimit - currentMonthViews)
    }, 'Template subscription status fetched'));
});

