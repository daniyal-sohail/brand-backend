const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has Canva team access
 * This ensures users can only access templates after being approved for team access
 */
const requireCanvaTeamAccess = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user has Canva team access
        if (!user.canvaTeamAccess) {
            return res.status(403).json({
                success: false,
                error: 'Canva access approval required',
                message: 'You need to request and be approved for Canva access before accessing templates. Please contact an administrator.',
                requiresTeamAccess: true
            });
        }

        // Add user's team access info to request for use in controllers
        req.user.canvaTeamAccess = user.canvaTeamAccess;
        req.user.canvaTeamRole = user.canvaTeamRole;

        next();
    } catch (error) {
        logger.error('Canva team access middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify Canva team access'
        });
    }
};

/**
 * Middleware to check if user has Canva connection (for editing templates)
 */
const requireCanvaConnection = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // First check if user has been approved for Canva access
        if (!user.canvaTeamAccess) {
            return res.status(403).json({
                success: false,
                error: 'Canva access approval required',
                message: 'You need to request and be approved for Canva access before editing templates.',
                requiresTeamAccess: true
            });
        }

        // Then check Canva connection
        if (!user.canvaConnected || !user.canvaAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Canva account not connected',
                message: 'Please connect your Canva account to edit templates.',
                requiresConnection: true
            });
        }

        // Add user's Canva info to request
        req.user.canvaTeamAccess = user.canvaTeamAccess;
        req.user.canvaTeamRole = user.canvaTeamRole;
        req.user.canvaConnected = user.canvaConnected;
        req.user.canvaAccessToken = user.canvaAccessToken;

        next();
    } catch (error) {
        logger.error('Canva connection middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify Canva connection'
        });
    }
};

/**
 * Optional middleware to check team access (doesn't block, just adds info)
 */
const checkCanvaTeamAccess = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            req.user.canvaTeamAccess = user.canvaTeamAccess || false;
            req.user.canvaTeamRole = user.canvaTeamRole;
            req.user.canvaConnected = user.canvaConnected || false;
        }

        next();
    } catch (error) {
        logger.error('Canva team access check middleware error:', error);
        // Don't block the request, just continue
        next();
    }
};

module.exports = {
    requireCanvaTeamAccess,
    requireCanvaConnection,
    checkCanvaTeamAccess
};
