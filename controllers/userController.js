const asyncHandler = require('express-async-handler');
const { User, CanvaAccessRequest } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { uploadToCloudinary, uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// Get user profile
exports.getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password -verificationToken -verificationTokenExpiry');
    if (!user) {
        logger.warn(`User not found: ${req.user.id}`);
        throw new ApiError(404, 'User not found');
    }
    logger.info('Profile fetched', { id: user._id });
    res.json(new ApiResponse(200, user, 'Profile fetched successfully'));
});

exports.updateProfile = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const updateData = {};

    if (name) {
        updateData.name = name;
    }

    if (req.file) {
        try {
            const result = await uploadBufferToCloudinary(req.file.buffer, 'profile-images', req.file.mimetype);

            const currentUser = await User.findById(req.user.id);

            if (currentUser && currentUser.profileImage) {
                const oldPublicId = currentUser.profileImage.split('/').pop().split('.')[0];
                await deleteFromCloudinary(oldPublicId, 'image');
            }

            updateData.profileImage = result.secure_url;

            logger.info('Profile image uploaded', { userId: req.user.id, imageUrl: result.secure_url });
        } catch (error) {
            logger.error('Profile image upload failed', { userId: req.user.id, error: error.message });
            throw new ApiError(500, 'Failed to upload profile image');
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No valid update data provided');
    }

    const user = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true, runValidators: true, select: '-password' }
    );

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    logger.info('Profile updated', { userId: user._id, updatedFields: Object.keys(updateData) });
    res.json(new ApiResponse(200, user, 'Profile updated successfully'));
});

exports.getUserTemplateHistory = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
        .populate('templateHistory.contentId', 'title imageUrl contentType categories')
        .select('templateHistory');

    if (!user) {
        logger.warn(`User not found: ${req.user.id}`);
        throw new ApiError(404, 'User not found');
    }

    const sortedHistory = user.templateHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    logger.info('Template history fetched', { userId: user._id });
    res.json(new ApiResponse(200, sortedHistory, 'Template history fetched successfully'));
});

exports.getUserDownloads = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
        .populate('downloads.contentId', 'title imageUrl contentType categories')
        .select('downloads');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Sort by most recent
    const sortedDownloads = user.downloads.sort((a, b) => new Date(b.downloadedAt) - new Date(a.downloadedAt));

    logger.info('User downloads fetched', { userId: user._id });
    res.json(new ApiResponse(200, sortedDownloads, 'Downloads fetched successfully'));
});


exports.getDashboardStats = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
        .select('templateHistory downloads bookmarks createdAt');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const stats = {
        totalTemplatesEdited: user.templateHistory.length,
        totalDownloads: user.downloads.length,
        totalBookmarks: user.bookmarks.length,
        memberSince: user.createdAt,
        recentActivity: {
            lastEdit: user.templateHistory.length > 0 ?
                user.templateHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt : null,
            lastDownload: user.downloads.length > 0 ?
                user.downloads.sort((a, b) => new Date(b.downloadedAt) - new Date(a.downloadedAt))[0].downloadedAt : null
        }
    };

    logger.info('Dashboard stats fetched', { userId: user._id });
    res.json(new ApiResponse(200, stats, 'Dashboard stats fetched successfully'));
});

// Admin: Get all users
exports.getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, role, verified } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    if (role) {
        filter.role = role;
    }

    if (verified !== undefined) {
        filter.isVerified = verified === 'true';
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get users with pagination
    const users = await User.find(filter)
        .select('-password -verificationToken -verificationTokenExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    logger.info('All users fetched by admin', { adminId: req.user.id, count: users.length });

    res.json(new ApiResponse(200, {
        users,
        pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    }, 'Users fetched successfully'));
});

// Admin: Get user by ID
exports.getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id)
        .select('-password -verificationToken -verificationTokenExpiry')
        .populate('templateHistory.contentId', 'title imageUrl contentType')
        .populate('bookmarks.contentId', 'title imageUrl contentType')
        .populate('downloads.contentId', 'title imageUrl contentType');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    logger.info('User fetched by admin', { adminId: req.user.id, userId: user._id });
    res.json(new ApiResponse(200, user, 'User fetched successfully'));
});

// Admin: Update user role
exports.updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['ADMIN', 'USER'].includes(role)) {
        throw new ApiError(400, 'Valid role (ADMIN or USER) is required');
    }

    // Prevent admin from removing their own admin role
    if (id === req.user.id && role === 'USER') {
        throw new ApiError(400, 'Cannot remove your own admin role');
    }

    const user = await User.findByIdAndUpdate(
        id,
        { role },
        { new: true, runValidators: true }
    ).select('-password -verificationToken -verificationTokenExpiry');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    logger.info('User role updated by admin', {
        adminId: req.user.id,
        userId: user._id,
        newRole: role
    });

    res.json(new ApiResponse(200, user, 'User role updated successfully'));
});

// Admin: Delete user
exports.deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
        throw new ApiError(400, 'Cannot delete your own account');
    }

    const user = await User.findById(id);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Delete user's profile image from Cloudinary if exists
    if (user.profileImage) {
        try {
            const publicId = user.profileImage.split('/').pop().split('.')[0];
            await deleteFromCloudinary(publicId, 'image');
        } catch (error) {
            logger.error('Failed to delete profile image from Cloudinary', {
                userId: user._id,
                error: error.message
            });
        }
    }

    // Delete user
    await User.findByIdAndDelete(id);

    logger.info('User deleted by admin', { adminId: req.user.id, userId: user._id });
    res.json(new ApiResponse(200, null, 'User deleted successfully'));
});

// Admin: Get user statistics
exports.getUserStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = await User.countDocuments({ isVerified: false });
    const adminUsers = await User.countDocuments({ role: 'ADMIN' });
    const regularUsers = await User.countDocuments({ role: 'USER' });

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRegistrations = await User.countDocuments({
        createdAt: { $gte: sevenDaysAgo }
    });

    // Get users by month (last 6 months)
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - i);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const count = await User.countDocuments({
            createdAt: { $gte: startDate, $lt: endDate }
        });

        monthlyStats.push({
            month: startDate.toLocaleString('default', { month: 'short' }),
            count
        });
    }

    const stats = {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        adminUsers,
        regularUsers,
        recentRegistrations,
        monthlyStats
    };

    logger.info('User statistics fetched by admin', { adminId: req.user.id });
    res.json(new ApiResponse(200, stats, 'User statistics fetched successfully'));
});

// ============================================================================
// CANVA ACCESS REQUEST FUNCTIONS
// ============================================================================

// Request Canva access
exports.requestCanvaAccess = asyncHandler(async (req, res) => {
    const { requestReason, businessType } = req.body;

    // Check if user already has a pending request
    const existingRequest = await CanvaAccessRequest.findOne({
        userId: req.user._id,
        status: 'PENDING'
    });

    if (existingRequest) {
        throw new ApiError(400, 'You already have a pending Canva access request');
    }

    // Check if user already has team access
    const user = await User.findById(req.user._id);
    if (user.canvaTeamAccess) {
        throw new ApiError(400, 'You already have Canva team access');
    }

    // Create new access request
    const accessRequest = new CanvaAccessRequest({
        userId: req.user._id,
        userName: user.name,
        userEmail: user.email,
        requestReason: requestReason || '',
        businessType: businessType || user.businessType || ''
    });

    await accessRequest.save();

    logger.info('User requested Canva access', {
        userId: req.user._id,
        requestId: accessRequest._id
    });

    res.status(201).json(new ApiResponse(201, accessRequest, 'Canva access request submitted successfully'));
});

// Get user's Canva access request status
exports.getCanvaAccessRequestStatus = asyncHandler(async (req, res) => {
    const accessRequest = await CanvaAccessRequest.findOne({ userId: req.user._id })
        .sort({ createdAt: -1 });

    if (!accessRequest) {
        return res.json(new ApiResponse(200, {
            hasRequest: false,
            canvaTeamAccess: false
        }, 'No access request found'));
    }

    const user = await User.findById(req.user._id);

    res.json(new ApiResponse(200, {
        hasRequest: true,
        request: accessRequest,
        canvaTeamAccess: user.canvaTeamAccess || false,
        canvaTeamRole: user.canvaTeamRole
    }, 'Access request status fetched successfully'));
});

