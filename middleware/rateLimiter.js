const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter with custom options
 * @param {Object} options - Rate limiting options
 * @returns {Function} Rate limiting middleware
 */
const rateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        trustProxy: true, // Trust proxy headers
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                route: req.route?.path,
                method: req.method,
                userAgent: req.get('User-Agent')
            });

            res.status(429).json({
                success: false,
                error: options.message || 'Too many requests from this IP, please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000) || 900
            });
        }
    };

    // Merge provided options with defaults
    const mergedOptions = { ...defaultOptions, ...options };

    return rateLimit(mergedOptions);
};

module.exports = {
    rateLimiter
}; 