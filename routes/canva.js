const express = require('express');
const router = express.Router();
const canvaController = require('../controllers/CanvaController');
const { protect } = require('../middleware/authMiddleware');

// ============================================================================
// KEEP THESE - Essential Canva connection routes
// ============================================================================
router.get('/connect', protect, canvaController.connectCanva);
router.get('/callback', canvaController.canvaCallback);
router.get('/connection-status', protect, canvaController.getConnectionStatus);


module.exports = router;