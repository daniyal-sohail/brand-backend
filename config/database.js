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
            logger.error('MongoDB URI not provided. Set MONGODB_URI env variable.');
            throw new Error('MongoDB URI not provided');
        }

        if (cached.conn) {
            logger.info('Using cached database connection');
            return cached.conn;
        }

        if (!cached.promise) {
            const options = {
                ...(dbName ? { dbName } : {}),
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000
            };

            logger.info('Connecting to MongoDB...');
            cached.promise = mongoose.connect(uri, options).then((m) => {
                logger.info(`MongoDB Connected: ${m.connection.host}`);
                return m;
            });
        }

        const conn = await cached.promise;
        cached.conn = conn;

        // Handle errors after initial connection
        mongoose.connection.on('error', err => {
            logger.error('MongoDB connection error:', {
                error: err.message,
                stack: err.stack
            });
            cached.conn = null;
            cached.promise = null;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            cached.conn = null;
            cached.promise = null;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

        return conn;
    } catch (error) {
        logger.error('Error connecting to MongoDB:', {
            error: error.message,
            stack: error.stack,
            uri_present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI)
        });
        cached.conn = null;
        cached.promise = null;
        throw error;
    }
};

module.exports = connectDB;