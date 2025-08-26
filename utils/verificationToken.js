const crypto = require('crypto');

// Generate verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate verification token expiry (24 hours from now)
const generateVerificationTokenExpiry = () => {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
};

// Check if verification token is expired
const isTokenExpired = (expiryDate) => {
    return new Date() > new Date(expiryDate);
};

module.exports = {
    generateVerificationToken,
    generateVerificationTokenExpiry,
    isTokenExpired
}; 