const express = require('express');
const router = express.Router();
const userTemplateController = require('../controllers/UserTemplateController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All routes require authentication

// Browse templates (no Canva requirements)
router.get('/', userTemplateController.getPublishedTemplates);
router.get('/:id', userTemplateController.getTemplateDetails);

// Get Canva share URL (simple redirect, no connection required)
router.get('/:id/edit-url', userTemplateController.getCanvaShareUrl);

// Bookmarks (no Canva requirements)
router.post('/:id/bookmark', userTemplateController.bookmarkTemplate);
router.delete('/:id/bookmark', userTemplateController.removeBookmark);
router.get('/bookmarks/my', userTemplateController.getUserBookmarks);

// History (no Canva requirements)
router.get('/history/my', userTemplateController.getUserTemplateHistory);

// Subscription status for templates (no Canva requirements)
router.get('/subscription/status', userTemplateController.getTemplateSubscriptionStatus);

module.exports = router;