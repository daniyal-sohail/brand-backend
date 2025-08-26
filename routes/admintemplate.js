const express = require('express');
const router = express.Router();
const adminTemplateController = require('../controllers/AdminTemplateController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Admin template management routes
router.use(protect, adminOnly);

// Import templates from Canva
router.get('/canva/available', adminTemplateController.getCanvaTemplatesForImport);
router.post('/import', adminTemplateController.importTemplateFromCanva);

// Template CRUD
router.get('/', adminTemplateController.getAdminTemplates);
router.put('/:id', adminTemplateController.updateTemplate);
router.delete('/:id', adminTemplateController.deleteTemplate);

// Publish/Unpublish
router.patch('/:id/toggle-publish', adminTemplateController.toggleTemplatePublish);

// ============================================================================
// CANVA ACCESS REQUEST ROUTES
// ============================================================================

// Get all Canva access requests with filtering and pagination
router.get('/canva/access-requests', adminTemplateController.getAllCanvaAccessRequests);

// Approve Canva access request
router.put('/canva/access-requests/:id/approve', adminTemplateController.approveCanvaAccessRequest);

// Reject Canva access request
router.put('/canva/access-requests/:id/reject', adminTemplateController.rejectCanvaAccessRequest);

// Get Canva access statistics
router.get('/canva/access-stats', adminTemplateController.getCanvaAccessStats);

module.exports = router;