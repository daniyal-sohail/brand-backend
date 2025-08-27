// routes/index.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        res.status(200).json({
            status: 'success',
            message: 'API is healthy',
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(uptime / 60)} minutes`,
            database: {
                status: dbStatus,
                readyState: mongoose.connection.readyState
            },
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
            },
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./user');
const contentRoutes = require('./contentRoutes');
const faqRoutes = require('./faqRoutes');
const stripeRoutes = require('./stripe');
const planRoutes = require('./plan');
const canvaRoutes = require('./canva');
const userTemplateRoutes = require('./usertemplate');
const adminTemplateRoutes = require('./admintemplate');

// Use routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/content', contentRoutes);
router.use('/faqs', faqRoutes);
router.use('/stripe', stripeRoutes);
router.use('/plans', planRoutes);
router.use('/canva', canvaRoutes);
router.use('/templates', userTemplateRoutes);
router.use('/admin/templates', adminTemplateRoutes);

module.exports = router;