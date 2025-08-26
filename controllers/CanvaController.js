const asyncHandler = require('express-async-handler');
const canvaService = require('../services/CanvaService');
const { User } = require('../models');
const logger = require('../utils/logger');
const { handleExternalApiError, handleUnexpectedError } = require('../utils/errorUtils');
const crypto = require('crypto');

// ============================================================================
// KEEP THESE - Still needed for user Canva connection
// ============================================================================

exports.connectCanva = asyncHandler(async (req, res) => {
    try {
        // Check if user has been approved for Canva access
        const user = await User.findById(req.user._id);
        if (!user.canvaTeamAccess) {
            return res.status(403).json({
                success: false,
                error: 'Canva access approval required',
                message: 'You need to request and be approved for Canva access before connecting your account. Please contact an administrator.'
            });
        }

        // Generate PKCE parameters
        const codeVerifier = crypto.randomBytes(96).toString('base64url');
        const codeChallenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');

        global.codeVerifiers = global.codeVerifiers || {};
        global.codeVerifiers[req.user._id] = codeVerifier;

        const scopes = encodeURIComponent('design:content:read design:meta:read');
        const authUrl = `https://www.canva.com/api/oauth/authorize?code_challenge=${codeChallenge}&code_challenge_method=s256&scope=${scopes}&response_type=code&client_id=${process.env.CANVA_CLIENT_ID}&state=${req.user._id}&redirect_uri=${encodeURIComponent(process.env.CANVA_REDIRECT_URI)}`;

        res.json({ authUrl });
    } catch (error) {
        logger.error('Canva connection setup failed:', error);
        const errorResponse = handleUnexpectedError(error, 'Canva connection setup');
        res.status(errorResponse.statusCode).json(errorResponse.toJSON());
    }
});

exports.canvaCallback = asyncHandler(async (req, res) => {
    logger.info('Canva callback received:', {
        query: req.query,
        fullURL: req.originalUrl
    });

    const { code, state: userId, error, error_description } = req.query;

    if (error) {
        logger.error('Canva OAuth error:', { error, error_description });
        return res.status(400).json({
            success: false,
            error: `Canva OAuth error: ${error}`,
            description: error_description || 'Unknown error'
        });
    }

    if (!code || !userId) {
        logger.error('Missing parameters in callback:', { code: !!code, userId: !!userId });
        return res.status(400).json({
            success: false,
            error: 'Missing authorization code or user ID',
            debug: {
                hasCode: !!code,
                hasUserId: !!userId,
                receivedParams: Object.keys(req.query)
            }
        });
    }

    try {
        global.codeVerifiers = global.codeVerifiers || {};
        const codeVerifier = global.codeVerifiers[userId];

        if (!codeVerifier) {
            logger.error('Code verifier not found for user:', userId);
            return res.status(400).json({
                success: false,
                error: 'Code verifier not found. Please try connecting again.'
            });
        }

        const tokens = await canvaService.getTokens(code, codeVerifier);
        const userInfo = await canvaService.getUser(tokens.access_token);

        await User.findByIdAndUpdate(userId, {
            canvaAccessToken: tokens.access_token,
            canvaRefreshToken: tokens.refresh_token,
            canvaUserId: userInfo.id,
            canvaConnected: true
        });

        delete global.codeVerifiers[userId];

        logger.info('Canva connected successfully', { userId });

        res.json({
            success: true,
            message: 'Canva connected successfully!',
            user: {
                canvaUserId: userInfo.id,
                canvaUserName: userInfo.display_name || 'Unknown'
            }
        });

    } catch (error) {
        logger.error('Canva connection failed:', error.message);
        const errorResponse = handleExternalApiError(error, 'Canva');
        res.status(errorResponse.statusCode).json(errorResponse.toJSON());
    }
});

exports.getConnectionStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user?.canvaConnected) {
        return res.json({ connected: false });
    }

    try {
        const isValid = await canvaService.isTokenValid(user.canvaAccessToken);
        res.json({ connected: isValid });
    } catch (error) {
        logger.error('Failed to check connection:', error.message);
        res.json({ connected: false });
    }
});