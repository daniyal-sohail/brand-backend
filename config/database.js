// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        // Check if MONGO_URI is provided
        if (!process.env.MONGO_URI) {
            logger.warn('MONGO_URI not provided. Database connection skipped.');
            return;
        }

        console.log('Connecting to MongoDB...', process.env.MONGO_URI);
        const conn = await mongoose.connect(process.env.MONGO_URI);

        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Handle errors after initial connection
        mongoose.connection.on('error', err => {
            logger.error('MongoDB connection error:', {
                error: err.message,
                stack: err.stack
            });
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });
        // Handle process termination
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                logger.info('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                logger.error('Error during MongoDB shutdown:', {
                    error: err.message,
                    stack: err.stack
                });
                process.exit(1);
            }
        });
    } catch (error) {
        logger.error('Error connecting to MongoDB:', {
            error: error.message,
            stack: error.stack,
            uri: process.env.MONGO_URI ? process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'not provided' // Hide credentials in logs
        });
        // Don't exit the process, just log the error
        logger.warn('Continuing without database connection');
    }
};
module.exports = connectDB;