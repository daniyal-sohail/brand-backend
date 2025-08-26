// test-error-handling.js
// This file demonstrates the error handling capabilities of your backend

const { ErrorResponse, handleExternalApiError, handleDatabaseError, handleFileUploadError, handleAuthError, handleUnexpectedError } = require('./utils/errorUtils');

// Test different error scenarios
console.log('=== Error Handling Test ===\n');

// 1. Test External API Error
console.log('1. External API Error (Canva):');
const canvaError = new Error('Request failed');
canvaError.response = { status: 503, data: { message: 'Service unavailable' } };
const canvaErrorResponse = handleExternalApiError(canvaError, 'Canva');
console.log(canvaErrorResponse.toJSON());
console.log('');

// 2. Test Database Error
console.log('2. Database Validation Error:');
const dbError = new Error('Validation failed');
dbError.name = 'ValidationError';
dbError.errors = {
  email: { message: 'Email is required' },
  password: { message: 'Password must be at least 6 characters' }
};
const dbErrorResponse = handleDatabaseError(dbError);
console.log(dbErrorResponse.toJSON());
console.log('');

// 3. Test File Upload Error
console.log('3. File Upload Error:');
const uploadError = new Error('File too large');
uploadError.code = 'LIMIT_FILE_SIZE';
const uploadErrorResponse = handleFileUploadError(uploadError);
console.log(uploadErrorResponse.toJSON());
console.log('');

// 4. Test Authentication Error
console.log('4. Authentication Error:');
const authError = new Error('Token expired');
authError.name = 'TokenExpiredError';
const authErrorResponse = handleAuthError(authError);
console.log(authErrorResponse.toJSON());
console.log('');

// 5. Test Unexpected Error
console.log('5. Unexpected Error:');
const unexpectedError = new Error('Something went wrong');
const unexpectedErrorResponse = handleUnexpectedError(unexpectedError, 'User Controller');
console.log(unexpectedErrorResponse.toJSON());
console.log('');

console.log('=== Error Handling Test Complete ===');