const express = require('express');

const {
  createPlan,
  updatePlan,
  deletePlan,
  getPublicPlans,
  getAllPlans
} = require('../controllers/planController');

const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ensureDatabaseConnection } = require('../middleware/databaseMiddleware');
const router = express.Router();

// Apply database connection middleware to all plan routes
router.use(ensureDatabaseConnection);

router.post('/create-plan', protect, adminOnly, createPlan);
router.patch('/update-plan/:id', protect, adminOnly, updatePlan);
router.delete('/delete-plan/:id', protect, adminOnly, deletePlan);
router.get('/admin-plans', protect, adminOnly, getAllPlans);
router.get('/', getPublicPlans);

module.exports = router;