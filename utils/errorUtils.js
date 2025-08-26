// utils/errorUtils.js
const logger = require('./logger');

/**
 * Standardized error response format
 */
class ErrorResponse {
  constructor(statusCode, message, details = null) {
    this.statusCode = statusCode;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Handle external API errors gracefully
 */
const handleExternalApiError = (error, serviceName) => {
  logger.error(`${serviceName} API Error:`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
    stack: error.stack
  });

  if (error.response?.status >= 500) {
    return new ErrorResponse(503, `${serviceName} service is temporarily unavailable`);
  }

  if (error.response?.status === 404) {
    return new ErrorResponse(404, `${serviceName} resource not found`);
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    return new ErrorResponse(401, `${serviceName} authentication failed`);
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new ErrorResponse(503, `${serviceName} service is unavailable`);
  }

  if (error.code === 'ETIMEDOUT') {
    return new ErrorResponse(408, `${serviceName} request timeout`);
  }

  return new ErrorResponse(500, `Error communicating with ${serviceName}`);
};

/**
 * Handle database operation errors
 */
const handleDatabaseError = (error) => {
  logger.error('Database Error:', {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: error.stack
  });

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return new ErrorResponse(400, 'Validation failed', errors);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return new ErrorResponse(409, `${field} already exists`);
  }

  if (error.name === 'CastError') {
    return new ErrorResponse(400, `Invalid ${error.path}: ${error.value}`);
  }

  return new ErrorResponse(500, 'Database operation failed');
};

/**
 * Handle file upload errors
 */
const handleFileUploadError = (error) => {
  logger.error('File Upload Error:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new ErrorResponse(400, 'File size exceeds limit');
    case 'LIMIT_FILE_COUNT':
      return new ErrorResponse(400, 'Too many files uploaded');
    case 'LIMIT_UNEXPECTED_FILE':
      return new ErrorResponse(400, 'Unexpected file field');
    case 'LIMIT_FIELD_KEY':
      return new ErrorResponse(400, 'Field name too long');
    case 'LIMIT_FIELD_VALUE':
      return new ErrorResponse(400, 'Field value too long');
    case 'LIMIT_FIELD_COUNT':
      return new ErrorResponse(400, 'Too many fields');
    default:
      return new ErrorResponse(500, 'File upload failed');
  }
};

/**
 * Handle authentication errors
 */
const handleAuthError = (error) => {
  logger.error('Authentication Error:', {
    message: error.message,
    name: error.name,
    stack: error.stack
  });

  if (error.name === 'JsonWebTokenError') {
    return new ErrorResponse(401, 'Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return new ErrorResponse(401, 'Token expired');
  }

  if (error.name === 'NotBeforeError') {
    return new ErrorResponse(401, 'Token not active');
  }

  return new ErrorResponse(401, 'Authentication failed');
};

/**
 * Generic error handler for unexpected errors
 */
const handleUnexpectedError = (error, context = '') => {
  logger.error(`Unexpected Error${context ? ` in ${context}` : ''}:`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  });

  return new ErrorResponse(500, 'An unexpected error occurred');
};

module.exports = {
  ErrorResponse,
  handleExternalApiError,
  handleDatabaseError,
  handleFileUploadError,
  handleAuthError,
  handleUnexpectedError
};