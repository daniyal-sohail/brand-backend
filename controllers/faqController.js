const asyncHandler = require('express-async-handler');
const { Faq } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Create FAQ
exports.createFaq = asyncHandler(async (req, res) => {
  const { question, answer } = req.body;
  const faq = new Faq({ question, answer });
  await faq.save();
  logger.info('FAQ created', { id: faq._id });
  res.status(201).json(new ApiResponse(201, faq, 'FAQ created successfully'));
});

// Get all FAQs
exports.getAllFaqs = asyncHandler(async (req, res) => {
  const faqs = await Faq.find().sort({ createdAt: -1 });
  logger.info('Fetched all FAQs');
  res.json(new ApiResponse(200, faqs, 'FAQs fetched successfully'));
});

// Get single FAQ
exports.getFaqById = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) {
    logger.warn(`FAQ not found: ${req.params.id}`);
    throw new ApiError(404, 'FAQ not found');
  }
  logger.info('Fetched FAQ', { id: faq._id });
  res.json(new ApiResponse(200, faq, 'FAQ fetched successfully'));
});

// Update FAQ
exports.updateFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!faq) {
    logger.warn(`FAQ not found for update: ${req.params.id}`);
    throw new ApiError(404, 'FAQ not found');
  }
  logger.info('Updated FAQ', { id: faq._id });
  res.json(new ApiResponse(200, faq, 'FAQ updated successfully'));
});

// Delete FAQ
exports.deleteFaq = asyncHandler(async (req, res) => {
  const deleted = await Faq.findByIdAndDelete(req.params.id);
  if (!deleted) {
    logger.warn(`FAQ not found for delete: ${req.params.id}`);
    throw new ApiError(404, 'FAQ not found');
  }
  logger.info('Deleted FAQ', { id: deleted._id });
  res.json(new ApiResponse(200, null, 'FAQ deleted successfully'));
});
