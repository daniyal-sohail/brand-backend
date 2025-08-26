const asyncHandler = require('express-async-handler');
const { Template, CanvaAccessRequest, User } = require('../models');
const canvaService = require('../services/CanvaService');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

// Get admin's Canva templates (for importing)
exports.getCanvaTemplatesForImport = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user?.canvaConnected) {
        return res.status(400).json({ error: 'Canva not connected' });
    }

    if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    // Get query parameters for filtering and pagination
    const {
        page = 1,
        limit = 20,
        search = '',
        category = '',
        sortBy = 'newest',
        contentType = ''
    } = req.query;

    try {
        const canvaResponse = await canvaService.getTemplates(user.canvaAccessToken, limit * 2, search);

        // Handle both brand templates and designs response formats
        const canvaTemplates = canvaResponse.items || canvaResponse.designs || [];

        if (!Array.isArray(canvaTemplates)) {
            logger.error('Invalid templates response format:', canvaResponse);
            return res.status(500).json({ error: 'Invalid response format from Canva' });
        }

        const existingTemplateIds = await Template.find({}, 'canvaTemplateId').lean();
        const existingIds = existingTemplateIds.map(t => t.canvaTemplateId);

        // Filter out already imported templates
        let availableTemplates = canvaTemplates.filter(
            template => !existingIds.includes(template.id)
        );

        // Apply additional filters
        if (category) {
            availableTemplates = availableTemplates.filter(template =>
                template.category?.toLowerCase().includes(category.toLowerCase()) ||
                template.tags?.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
            );
        }

        if (contentType) {
            availableTemplates = availableTemplates.filter(template =>
                template.contentType?.toLowerCase().includes(contentType.toLowerCase()) ||
                template.type?.toLowerCase().includes(contentType.toLowerCase())
            );
        }

        // Apply sorting
        switch (sortBy) {
            case 'newest':
                availableTemplates.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
                break;
            case 'oldest':
                availableTemplates.sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0));
                break;
            case 'title':
                availableTemplates.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
                break;
            case 'popular':
                availableTemplates.sort((a, b) => (b.usage_count || b.views || 0) - (a.usage_count || a.views || 0));
                break;
            default:
                availableTemplates.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
        }

        // Apply pagination
        const totalItems = availableTemplates.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedTemplates = availableTemplates.slice(startIndex, endIndex);

        res.json(new ApiResponse(200, {
            templates: paginatedTemplates,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                limit: parseInt(limit)
            },
            filters: {
                search,
                category,
                contentType,
                sortBy
            }
        }, 'Canva templates fetched'));
    } catch (error) {
        logger.error('Failed to get Canva templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Import template from Canva
exports.importTemplateFromCanva = asyncHandler(async (req, res) => {
    const {
        canvaTemplateId,
        title,
        description,
        instruction,
        caption,
        tags,
        contentType,
        thumbnailUrl,
        canvaTemplateUrl
    } = req.body;



    // Check if template with same URL already exists
    const existingTemplate = await Template.findOne({ canvaTemplateUrl });
    if (existingTemplate) {
        throw new ApiError(400, 'Template with this URL already exists');
    }

    const template = new Template({
        title,
        description,
        instruction,
        caption,
        tags: tags || [],
        contentType,
        canvaTemplateId: canvaTemplateId || null, // Make optional
        canvaTemplateUrl,
        canvaEditUrl: canvaTemplateId ? `https://www.canva.com/design/${canvaTemplateId}/edit` : null,
        thumbnailUrl,
        createdByAdmin: req.user._id,
        isPublished: false
    });

    await template.save();

    logger.info('Template imported', {
        templateId: template._id,
        canvaTemplateUrl: canvaTemplateUrl ? 'provided' : 'not provided',
        adminId: req.user._id
    });

    res.status(201).json(new ApiResponse(201, template, 'Template imported successfully'));
});

exports.getAdminTemplates = asyncHandler(async (req, res) => {


    const { page = 1, limit = 20, search, contentType, status } = req.query;

    const filter = { createdByAdmin: req.user._id };

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

    if (status === 'published') {
        filter.isPublished = true;
    } else if (status === 'draft') {
        filter.isPublished = false;
    }

    const templates = await Template.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const total = await Template.countDocuments(filter);

    res.json(new ApiResponse(200, {
        templates,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        }
    }, 'Admin templates fetched'));
});

// Update template details
exports.updateTemplate = asyncHandler(async (req, res) => {


    const template = await Template.findById(req.params.id);

    if (!template) {
        throw new ApiError(404, 'Template not found');
    }

    if (template.createdByAdmin.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Not authorized to update this template');
    }

    const { title, description, instruction, caption, tags, contentType, canvaTemplateUrl, thumbnailUrl } = req.body;

    template.title = title || template.title;
    template.description = description || template.description;
    template.instruction = instruction || template.instruction;
    template.caption = caption || template.caption;
    template.tags = tags || template.tags;
    template.contentType = contentType || template.contentType;
    template.canvaTemplateUrl = canvaTemplateUrl || template.canvaTemplateUrl;
    template.thumbnailUrl = thumbnailUrl || template.thumbnailUrl;
    template.updatedAt = new Date();

    await template.save();

    logger.info('Template updated', { templateId: template._id });
    res.json(new ApiResponse(200, template, 'Template updated successfully'));
});

// Publish/Unpublish template
exports.toggleTemplatePublish = asyncHandler(async (req, res) => {


    const template = await Template.findById(req.params.id);

    if (!template) {
        throw new ApiError(404, 'Template not found');
    }

    if (template.createdByAdmin.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Not authorized to modify this template');
    }

    template.isPublished = !template.isPublished;
    template.publishedAt = template.isPublished ? new Date() : null;
    template.updatedAt = new Date();

    await template.save();

    const action = template.isPublished ? 'published' : 'unpublished';
    logger.info(`Template ${action}`, { templateId: template._id });

    res.json(new ApiResponse(200, template, `Template ${action} successfully`));
});

// Delete template
exports.deleteTemplate = asyncHandler(async (req, res) => {

    const template = await Template.findById(req.params.id);

    if (!template) {
        throw new ApiError(404, 'Template not found');
    }

    if (template.createdByAdmin.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Not authorized to delete this template');
    }

    await template.deleteOne();

    logger.info('Template deleted', { templateId: template._id });
    res.json(new ApiResponse(200, null, 'Template deleted successfully'));
});

// ============================================================================
// CANVA ACCESS REQUEST MANAGEMENT
// ============================================================================

// Get all Canva access requests (admin dashboard)
exports.getAllCanvaAccessRequests = asyncHandler(async (req, res) => {
    const {
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (status) {
        query.status = status.toUpperCase();
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const requests = await CanvaAccessRequest.find(query)
        .populate('userId', 'name email businessType')
        .populate('processedBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await CanvaAccessRequest.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get statistics
    const stats = await CanvaAccessRequest.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const statusStats = {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
        PROCESSING: 0
    };

    stats.forEach(stat => {
        statusStats[stat._id] = stat.count;
    });

    logger.info('Admin fetched Canva access requests', {
        adminId: req.user._id,
        total,
        filters: { status }
    });

    res.json(new ApiResponse(200, {
        requests,
        pagination: {
            currentPage: parseInt(page),
            totalPages,
            total,
            limit: parseInt(limit)
        },
        stats: statusStats
    }, 'Canva access requests fetched successfully'));
});

// Approve Canva access request
exports.approveCanvaAccessRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminNotes, canvaTeamRole = 'member' } = req.body;

    const request = await CanvaAccessRequest.findById(id)
        .populate('userId', 'name email');

    if (!request) {
        throw new ApiError(404, 'Canva access request not found');
    }

    if (request.status !== 'PENDING') {
        throw new ApiError(400, 'Request is not in pending status');
    }

    // Update request status to processing
    request.status = 'PROCESSING';
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    request.adminNotes = adminNotes;
    await request.save();

    try {
        // Get admin's Canva access token
        const admin = await User.findById(req.user._id);
        if (!admin.canvaConnected || !admin.canvaAccessToken) {
            throw new ApiError(400, 'Admin must be connected to Canva to approve requests');
        }

        // Check if user is already in team
        const isAlreadyInTeam = await canvaService.isUserInTeam(admin.canvaAccessToken, request.userEmail);
        if (isAlreadyInTeam) {
            // User is already in team, just update the request status
            request.status = 'APPROVED';
            request.canvaTeamRole = canvaTeamRole;
            await request.save();

            // Update user's Canva access status
            await User.findByIdAndUpdate(request.userId._id, {
                canvaTeamAccess: true,
                canvaTeamRole: canvaTeamRole
            });
        } else {
            // Approve user for Canva access
            const approvalResponse = await canvaService.approveUserForCanvaAccess(
                admin.canvaAccessToken,
                request.userEmail,
                canvaTeamRole
            );

            // Update request with approval details
            request.status = 'APPROVED';
            request.canvaTeamMemberId = approvalResponse.id;
            request.canvaTeamRole = canvaTeamRole;
            request.adminNotes = request.adminNotes || 'User approved for Canva access. User must connect their own Canva account.';
            await request.save();

            // Update user's Canva access status
            await User.findByIdAndUpdate(request.userId._id, {
                canvaTeamAccess: true,
                canvaTeamRole: canvaTeamRole
            });
        }

        logger.info('Admin approved Canva access request', {
            adminId: req.user._id,
            requestId: id,
            userId: request.userId._id
        });

        res.json(new ApiResponse(200, request, 'Canva access request approved successfully'));

    } catch (error) {
        // Revert status if Canva team addition fails
        request.status = 'PENDING';
        request.processedBy = null;
        request.processedAt = null;
        await request.save();

        logger.error('Failed to add user to Canva team - Controller error:', {
            adminId: req.user._id,
            requestId: id,
            userEmail: request.userEmail,
            error: error.message,
            stack: error.stack
        });

        // Provide more specific error messages based on the error type
        let errorMessage = 'Failed to add user to Canva team. Please try again.';
        let statusCode = 500;

        if (error.message.includes('token expired')) {
            errorMessage = 'Admin Canva token has expired. Please reconnect your Canva account.';
            statusCode = 401;
        } else if (error.message.includes('Insufficient permissions')) {
            errorMessage = 'Admin does not have sufficient permissions to manage team members.';
            statusCode = 403;
        } else if (error.message.includes('already a member')) {
            errorMessage = 'User is already a member of the Canva team.';
            statusCode = 409;
        } else if (error.message.includes('Invalid request')) {
            errorMessage = `Invalid request: ${error.message}`;
            statusCode = 400;
        }

        throw new ApiError(statusCode, errorMessage);
    }
});

// Reject Canva access request
exports.rejectCanvaAccessRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const request = await CanvaAccessRequest.findById(id);

    if (!request) {
        throw new ApiError(404, 'Canva access request not found');
    }

    if (request.status !== 'PENDING') {
        throw new ApiError(400, 'Request is not in pending status');
    }

    request.status = 'REJECTED';
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    request.adminNotes = adminNotes;
    await request.save();

    logger.info('Admin rejected Canva access request', {
        adminId: req.user._id,
        requestId: id
    });

    res.json(new ApiResponse(200, request, 'Canva access request rejected successfully'));
});

// Get Canva access request statistics
exports.getCanvaAccessStats = asyncHandler(async (req, res) => {
    const stats = await CanvaAccessRequest.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const statusStats = {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
        PROCESSING: 0
    };

    stats.forEach(stat => {
        statusStats[stat._id] = stat.count;
    });

    // Get recent requests (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRequests = await CanvaAccessRequest.countDocuments({
        createdAt: { $gte: sevenDaysAgo }
    });

    // Get monthly trends
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - i);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const count = await CanvaAccessRequest.countDocuments({
            createdAt: { $gte: startDate, $lt: endDate }
        });

        monthlyStats.push({
            month: startDate.toLocaleString('default', { month: 'short' }),
            count
        });
    }

    const responseStats = {
        ...statusStats,
        recentRequests,
        monthlyStats
    };

    logger.info('Admin fetched Canva access statistics', { adminId: req.user._id });

    res.json(new ApiResponse(200, responseStats, 'Canva access statistics fetched successfully'));
});

