const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const contentController = require('../controllers/contentController');
const { protect } = require('../middleware/authMiddleware');
const queryHelper = require('../middleware/query');
const { ContentItem } = require('../models');
const { ensureDatabaseConnection } = require('../middleware/databaseMiddleware');

const router = express.Router();

// Apply database connection middleware to all content routes
router.use(ensureDatabaseConnection);

// Multer config: use memory storage to avoid EROFS on Vercel
const upload = multer({ storage: multer.memoryStorage() });

// Basic CRUD routes
router.route('/')
  .get(queryHelper(ContentItem))
  .post(upload.array('media', 5), protect, contentController.createContent)

router.route('/:id')
  .get(contentController.getContentById)
  .put(upload.array('media', 5), protect, contentController.updateContent)
  .delete(protect, contentController.deleteContent);

// Trending and analytics routes
router.get('/trending/templates', contentController.getTrendingTemplates);
router.post('/:id/view', contentController.incrementView);
router.post('/:id/download', protect, contentController.trackDownload);

// Bookmark routes
router.get('/bookmarks/user', protect, contentController.getUserBookmarks);
router.post('/bookmarks', protect, contentController.addBookmark);
router.delete('/bookmarks/:contentId', protect, contentController.removeBookmark);

module.exports = router;