// utils/logger.js
const winston = require('winston');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { service: 'Brand-appeal' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    })
  ]
});

// Only add file transports in development and non-serverless environments
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
  try {
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }));
    logger.add(new winston.transports.File({
      filename: 'logs/combined.log'
    }));
  } catch (error) {
    console.warn('Could not add file transports:', error.message);
  }
}

module.exports = logger;