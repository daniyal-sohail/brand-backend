const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware to handle validation errors from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));

        logger.warn('Validation errors', {
            route: req.route?.path,
            method: req.method,
            errors: errorMessages,
            userId: req.user?._id
        });

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
    }

    next();
};

/**
 * Custom validation middleware for MongoDB ObjectId
 * @param {string} field - Field name to validate
 */
const validateObjectId = (field) => {
    return (req, res, next) => {
        const mongoose = require('mongoose');
        const value = req.params[field] || req.body[field];

        if (value && !mongoose.Types.ObjectId.isValid(value)) {
            logger.warn(`Invalid ObjectId format for ${field}`, {
                value,
                route: req.route?.path,
                method: req.method
            });

            return res.status(400).json({
                success: false,
                message: `Invalid ${field} format`,
                errors: [{
                    field,
                    message: `${field} must be a valid MongoDB ObjectId`,
                    value
                }]
            });
        }

        next();
    };
};

/**
 * Sanitize input data by removing potentially harmful characters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
    // Remove any script tags or potentially harmful content
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                obj[key] = sanitizeObject(obj[key]);
            }
        }
        return obj;
    };

    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }

    next();
};

module.exports = {
    handleValidationErrors,
    validateObjectId,
    sanitizeInput
}; 