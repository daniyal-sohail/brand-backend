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
const { ensureDatabaseConnection } = require('../middleware/databaseMiddleware');

// Apply database connection middleware to all auth routes
router.use(ensureDatabaseConnection);

// Authentication routes only
router.post('/login', loginValidation, login);
router.post('/register', register);
router.post('/logout', logout);

// Email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/verification-status/:email', checkVerificationStatus);

module.exports = router;