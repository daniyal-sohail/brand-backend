const express = require('express');

const {
  createPlan,
  updatePlan,
  deletePlan,
  getPublicPlans,
  getAllPlans
} = require('../controllers/planController');

const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create-plan', protect, adminOnly, createPlan);
router.patch('/update-plan/:id', protect, adminOnly, updatePlan);
router.delete('/delete-plan/:id', protect, adminOnly, deletePlan);
router.get('/admin-plans', protect, adminOnly, getAllPlans);
router.get('/', getPublicPlans);

module.exports = router;