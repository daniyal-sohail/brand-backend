// middleware/errorMiddleware.js

const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');

// Custom AppError class for this middleware
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware to validate MongoDB ObjectId format
exports.validateObjectId = (req, res, next) => {
  const idParams = ['_id', 'adminId', 'userId', 'customerId', 'classId', "studentId", "teacherId", "parentId", "familyId", "taskId", "invoiceId", "groupId", "notificationId", "roomId", "paymentId"]; // Add all possible ID param names used in your routes

  for (const param of idParams) {
    if (req.params[param] && !mongoose.Types.ObjectId.isValid(req.params[param])) {
      return next(new AppError(`Invalid ${param} format`, StatusCodes.BAD_REQUEST));
    }
  }

  next();
};

// Global error handler middleware
exports.globalErrorHandler = (err, req, res, next) => {
  // Set defaults
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Something went wrong';

  // Log error for server logs
  console.error('ERROR:', err);

  // Handle known error types

  // MongoDB Cast Error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    const field = Object.keys(err.keyValue).join(', ');
    message = `Duplicate field value: ${field}. Please use another value.`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Your token has expired. Please log in again.';
  }

  // Handle network/connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    message = 'Service temporarily unavailable. Please try again later.';
  }

  // Handle timeout errors
  if (err.code === 'ETIMEDOUT') {
    statusCode = StatusCodes.REQUEST_TIMEOUT;
    message = 'Request timeout. Please try again.';
  }

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'File too large. Please upload a smaller file.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Unexpected file field. Please check your upload.';
  }

  // Development vs Production error response
  if (process.env.NODE_ENV === 'development') {
    // In development, send detailed error information
    return res.status(statusCode).json({
      status: 'error',
      message,
      error: err,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    });
  } else {
    // In production, send clean error response
    return res.status(statusCode).json({
      status: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  }
};

// Unhandled route middleware
exports.undefinedRouteHandler = (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, StatusCodes.NOT_FOUND));
};

// Handle async errors without try-catch
exports.catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};