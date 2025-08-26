const { User } = require('../models');
const canvaService = require('../services/CanvaService');
const logger = require('../utils/logger');

const validateCanvaConnection = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!user.canvaConnected || !user.canvaAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Canva account not connected',
                requiresConnection: true
            });
        }

        const connectionTest = await canvaService.testConnection(user.canvaAccessToken);

        if (connectionTest.valid) {
            req.canvaAccessToken = user.canvaAccessToken;
            return next();
        }

        if (!connectionTest.needsReauth || !user.canvaRefreshToken) {
            await User.findByIdAndUpdate(req.user._id, {
                canvaConnected: false,
                $unset: {
                    canvaAccessToken: 1,
                    canvaRefreshToken: 1
                }
            });

            return res.status(401).json({
                success: false,
                error: 'Canva authentication expired. Please reconnect your account.',
                requiresReauth: true
            });
        }

        try {
            const tokenData = await canvaService.refreshAccessToken(user.canvaRefreshToken);

            await User.findByIdAndUpdate(req.user._id, {
                canvaAccessToken: tokenData.access_token,
                canvaRefreshToken: tokenData.refresh_token || user.canvaRefreshToken
            });

            req.canvaAccessToken = tokenData.access_token;

            logger.info('Canva token refreshed successfully', { userId: req.user._id });
            return next();

        } catch (refreshError) {
            logger.error('Failed to refresh Canva token', {
                userId: req.user._id,
                error: refreshError.message
            });

            await User.findByIdAndUpdate(req.user._id, {
                canvaConnected: false,
                $unset: {
                    canvaAccessToken: 1,
                    canvaRefreshToken: 1
                }
            });

            return res.status(401).json({
                success: false,
                error: 'Canva authentication expired and refresh failed. Please reconnect your account.',
                requiresReauth: true
            });
        }

    } catch (error) {
        logger.error('Canva connection validation error', {
            userId: req.user?._id,
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to validate Canva connection'
        });
    }
};

const checkCanvaPermissions = (requiredScopes = []) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user._id);

            if (!user || !user.canvaConnected) {
                return res.status(400).json({
                    success: false,
                    error: 'Canva account not connected'
                });
            }

            const grantedScopes = user.canvaScopes || ['design:read', 'design:write'];

            const hasRequiredScopes = requiredScopes.every(scope =>
                grantedScopes.includes(scope)
            );

            if (!hasRequiredScopes) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Canva permissions for this action',
                    requiredScopes,
                    grantedScopes
                });
            }

            next();
        } catch (error) {
            logger.error('Canva permissions check error', {
                userId: req.user?._id,
                error: error.message
            });

            return res.status(500).json({
                success: false,
                error: 'Failed to check Canva permissions'
            });
        }
    };
};

const logCanvaUsage = (action) => {
    return (req, res, next) => {
        const originalSend = res.json;

        res.json = function (data) {
            if (data.success !== false) {
                setImmediate(() => {
                    logger.info('Canva API usage', {
                        userId: req.user?._id,
                        action,
                        method: req.method,
                        route: req.route?.path,
                        timestamp: new Date(),
                        userAgent: req.get('User-Agent'),
                        ip: req.ip
                    });
                });
            }

            // Call original send method
            return originalSend.call(this, data);
        };

        next();
    };
};


const handleCanvaRateLimit = (req, res, next) => {
    // Store original send method
    const originalSend = res.json;

    // Override send method to handle rate limit responses
    res.json = function (data) {
        // Check if this is a rate limit error from Canva
        if (data.success === false &&
            (data.error?.includes('rate limit') || data.error?.includes('too many requests'))) {

            logger.warn('Canva rate limit hit', {
                userId: req.user?._id,
                route: req.route?.path,
                method: req.method
            });

            // Add retry-after header
            res.set('Retry-After', '60');

            return originalSend.call(this, {
                success: false,
                error: 'Canva API rate limit exceeded. Please try again in a minute.',
                retryAfter: 60
            });
        }

        // Call original send method
        return originalSend.call(this, data);
    };

    next();
};

module.exports = {
    validateCanvaConnection,
    checkCanvaPermissions,
    logCanvaUsage,
    handleCanvaRateLimit
};