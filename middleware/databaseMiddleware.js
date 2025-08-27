const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware to ensure database connection is available
 * This is especially important for serverless environments like Vercel
 */
const ensureDatabaseConnection = async (req, res, next) => {
    try {
        // Check if we have an active connection
        if (mongoose.connection.readyState !== 1) {
            logger.warn('Database not connected, attempting to connect...', {
                readyState: mongoose.connection.readyState,
                url: req.url,
                method: req.method
            });

            // Attempt to connect
            await connectDB();

            // Check again after connection attempt
            if (mongoose.connection.readyState !== 1) {
                logger.error('Failed to establish database connection', {
                    readyState: mongoose.connection.readyState,
                    url: req.url,
                    method: req.method
                });
                return res.status(503).json({
                    status: 'error',
                    message: 'Database connection unavailable. Please try again later.'
                });
            }

            logger.info('Database connection established', {
                url: req.url,
                method: req.method
            });
        }

        next();
    } catch (error) {
        logger.error('Database connection middleware error:', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method
        });

        return res.status(503).json({
            status: 'error',
            message: 'Database connection error. Please try again later.'
        });
    }
};

module.exports = {
    ensureDatabaseConnection
};
