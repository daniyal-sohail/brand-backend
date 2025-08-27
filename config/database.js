// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        const dbName = process.env.MONGODB_DB;

        console.log('Database connection attempt...');
        console.log('URI present:', !!uri);
        console.log('DB Name:', dbName);

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

        console.log('Connecting with options:', options);
        logger.info('Connecting to MongoDB...');
        const conn = await mongoose.connect(uri, options);
        logger.info(`MongoDB Connected: ${conn.connection.host}`);
        console.log('Database connected successfully!');

        return conn;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        logger.error('Error connecting to MongoDB:', {
            error: error.message,
            stack: error.stack,
            uri_present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI)
        });
        throw error;
    }
};

module.exports = connectDB;