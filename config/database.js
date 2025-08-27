// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        const dbName = process.env.MONGODB_DB;

        if (!uri) {
            logger.error('MongoDB URI not provided. Set MONGODB_URI env variable.');
            throw new Error('MongoDB URI not provided');
        }

        // For serverless environments, don't cache connections
        const options = {
            ...(dbName ? { dbName } : {}),
            maxPoolSize: 1, // Smaller pool for serverless
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000
        };

        logger.info('Connecting to MongoDB...');
        const conn = await mongoose.connect(uri, options);
        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        return conn;
    } catch (error) {
        logger.error('Error connecting to MongoDB:', {
            error: error.message,
            stack: error.stack,
            uri_present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI)
        });
        throw error;
    }
};

module.exports = connectDB;