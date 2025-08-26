const asyncHandler = require('express-async-handler');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

// Middleware to check if user is verified
exports.requireVerification = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (!user.isVerified) {
        throw new ApiError(403, 'Please verify your email address to access this feature. Check your email for verification link or request a new one.');
    }

    next();
});

// Optional verification check - doesn't block but adds verification status to request
exports.checkVerificationStatus = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (user) {
        req.user.isVerified = user.isVerified;
    }

    next();
}); 