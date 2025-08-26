const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const { adminOnly, protect } = require('../middleware/authMiddleware');
const queryHelper = require('../middleware/query');
const { Faq } = require('../models');

// Public Routes
router.get('/', queryHelper(Faq));
router.get('/:id', faqController.getFaqById);

// Admin Routes 
router.post('/admin/create-faq', protect, adminOnly, faqController.createFaq);


router.route('/admin/update-faq/:id')
  .put(protect, adminOnly, faqController.updateFaq)

router.route('/admin/delete-faq/:id')
  .delete(protect, adminOnly, faqController.deleteFaq);

module.exports = router;
