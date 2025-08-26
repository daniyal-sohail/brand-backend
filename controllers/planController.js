const { Plan } = require('../models');
const Stripe = require('stripe');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { createOrGetStripePriceId } = require('../utils/stripeUtils');

// 🆕 Create plan (admin)
exports.createPlan = asyncHandler(async (req, res) => {
    const { name, slug, description, amount, features } = req.body;

    if (!name || !slug || !amount) {
        throw new ApiError(400, 'Name, slug, and amount are required');
    }

    const stripePriceId = await createOrGetStripePriceId(name, amount);

    const plan = await Plan.create({
        name,
        slug,
        description,
        amount,
        features,
        stripePriceId,
        isActive: true
    });

    return res.status(201).json(
        new ApiResponse(201, plan, 'Plan created successfully')
    );
});

// ✏️ Update plan (admin)
exports.updatePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const plan = await Plan.findByIdAndUpdate(id, updates, { new: true });

    if (!plan) throw new ApiError(404, 'Plan not found');

    return res.status(200).json(
        new ApiResponse(200, plan, 'Plan updated successfully')
    );
});

// 🗑 Delete plan (admin)
exports.deletePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const plan = await Plan.findByIdAndDelete(id);

    if (!plan) throw new ApiError(404, 'Plan not found');

    return res.status(200).json(
        new ApiResponse(200, plan, 'Plan deleted successfully')
    );
});

// 👁‍🗨 Get all active plans (for frontend)
exports.getPublicPlans = asyncHandler(async (req, res) => {
    console.log('Fetching public plans...');
    const plans = await Plan.find({ isActive: true }).sort({ amount: 1 });

    return res.status(200).json(
        new ApiResponse(200, plans, 'Active plans fetched')
    );
});

// 🛠 Admin: Get all plans
exports.getAllPlans = asyncHandler(async (req, res) => {
    const plans = await Plan.find().sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, plans, 'All plans fetched')
    );
});
