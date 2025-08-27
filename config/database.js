// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let cached = global.__mongoose_conn;
if (!cached) {
    cached = global.__mongoose_conn = { conn: null, promise: null };
}

const connectDB = async () => {
    try {
        // Prefer MONGODB_URI, fallback to MONGO_URI
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        const dbName = process.env.MONGODB_DB;

        if (!uri) {
            logger.warn('MongoDB URI not provided. Set MONGODB_URI env. Skipping connection.');
            return;
        }

        if (cached.conn) {
            return cached.conn;
        }

        if (!cached.promise) {
            const options = {
                ...(dbName ? { dbName } : {}),
                // Optimized for serverless environments
                maxPoolSize: 1, // Reduce pool size for serverless
                minPoolSize: 0, // Allow 0 connections when idle
                serverSelectionTimeoutMS: 10000, // 10 seconds
                socketTimeoutMS: 45000, // 45 seconds
                // Connection timeout
                connectTimeoutMS: 10000,
                // Retry settings
                retryWrites: true,
                retryReads: true,
                // For serverless environments
                maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            };

            cached.promise = mongoose.connect(uri, options).then((m) => m);
        }
        const conn = await cached.promise;
        cached.conn = conn;

        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Handle errors after initial connection
        mongoose.connection.on('error', err => {
            logger.error('MongoDB connection error:', {
                error: err.message,
                stack: err.stack
            });
            // Reset cached connection on error
            cached.conn = null;
            cached.promise = null;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            // Reset cached connection on disconnect
            cached.conn = null;
            cached.promise = null;
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

        return conn;
    } catch (error) {
        logger.error('Error connecting to MongoDB:', {
            error: error.message,
            stack: error.stack,
            // Do not log full URI
            uri_present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI)
        });
        // Reset cached connection on error
        cached.conn = null;
        cached.promise = null;
        // Don't exit the process, just log the error
        logger.warn('Continuing without database connection');
        throw error; // Re-throw to handle in calling code
    }
};

// Function to close database connection (useful for serverless)
const closeDB = async () => {
    try {
        if (cached.conn) {
            await mongoose.connection.close();
            cached.conn = null;
            cached.promise = null;
            logger.info('MongoDB connection closed');
        }
    } catch (error) {
        logger.error('Error closing MongoDB connection:', {
            error: error.message,
            stack: error.stack
        });
    }
};

module.exports = { connectDB, closeDB };