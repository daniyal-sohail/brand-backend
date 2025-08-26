const router = require('express').Router();
const {
    login,
    register,
    loginValidation,
    logout,
    verifyEmail,
    resendVerification,
    checkVerificationStatus
} = require('../controllers/authController');

// Authentication routes only
router.post('/login', loginValidation, login);
router.post('/register', register);
router.post('/logout', logout);

// Email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/verification-status/:email', checkVerificationStatus);

module.exports = router;