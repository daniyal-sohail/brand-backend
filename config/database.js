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
            cached.promise = mongoose.connect(uri, {
                ...(dbName ? { dbName } : {}),
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000
            }).then((m) => m);
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
            // Do not log full URI
            uri_present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI)
        });
        // Don't exit the process, just log the error
        logger.warn('Continuing without database connection');
    }
};
module.exports = connectDB;