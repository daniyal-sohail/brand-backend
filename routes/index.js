// routes/index.js
const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('./auth');
const userRoutes = require('./user');
const contentRoutes = require('./contentRoutes');
const faqRoutes = require('./faqRoutes');
const stripeRoutes = require('./stripe');
const planRoutes = require('./plan');
const canvaRoutes = require('./canva');
const adminTemplateRoutes = require('./admintemplate');
const userTemplateRoutes = require('./usertemplate');

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/content', contentRoutes);
router.use('/faqs', faqRoutes);
router.use('/stripe', stripeRoutes);
router.use('/plans', planRoutes);
router.use('/canva', canvaRoutes);
router.use('/admin/templates', adminTemplateRoutes);
router.use('/templates', userTemplateRoutes);

module.exports = router;