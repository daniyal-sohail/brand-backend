const asyncHandler = require('express-async-handler');
const { ContentItem } = require('../models');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const fs = require('fs');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Create content
exports.createContent = asyncHandler(async (req, res) => {
  const { title, description, instruction, caption, contentType, categories, tags } = req.body;
  const images = [];
  const videos = [];
  const files = req.files || [];

  logger.info(`Received ${files.length} files for upload: ${files.map(f => f.originalname).join(', ')}`);

  for (const file of files) {
    const result = await uploadToCloudinary(file.path);
    fs.unlinkSync(file.path);
    if (file.mimetype.startsWith('image/')) images.push(result.secure_url);
    else if (file.mimetype.startsWith('video/')) videos.push(result.secure_url);
  }

  logger.info(`Uploaded images: ${images.length}, videos: ${videos.length}`);

  const newContent = new ContentItem({
    title,
    description,
    instruction,
    caption,
    contentType,
    categories,
    tags,
    imageUrl: images,
    videoUrl: videos,
    createdById: req.user.id
  });

  await newContent.save();
  logger.info('Content created', { id: newContent._id });
  res.status(201).json(new ApiResponse(201, newContent, 'Content created successfully'));
});

// Get all content
exports.getAllContent = asyncHandler(async (req, res) => {
  const items = await ContentItem.find().sort({ createdAt: -1 });
  logger.info('Fetched all content items');
  res.json(new ApiResponse(200, items, 'Content fetched successfully'));
});

// Get content by ID
exports.getContentById = asyncHandler(async (req, res) => {
  const item = await ContentItem.findById(req.params.id);
  if (!item) {
    logger.warn(`Content not found: ${req.params.id}`);
    throw new ApiError(404, 'Content not found');
  }
  logger.info('Fetched content item', { id: item._id });
  res.json(new ApiResponse(200, item, 'Content fetched successfully'));
});

// Update content
exports.updateContent = asyncHandler(async (req, res) => {
  const { title, description, instruction, caption, contentType, categories, tags } = req.body;
  const content = await ContentItem.findById(req.params.id);
  if (!content) {
    logger.warn(`Content not found for update: ${req.params.id}`);
    throw new ApiError(404, 'Content not found');
  }
  // Delete old media
  const deleteMedia = async (urls, type) => {
    for (const url of urls) {
      const publicId = url.split('/').pop().split('.')[0];
      await deleteFromCloudinary(publicId, type);
    }
  };
  await deleteMedia(content.imageUrl, 'image');
  await deleteMedia(content.videoUrl, 'video');
  // Upload new media
  const images = [], videos = [];
  const files = req.files || [];
  for (const file of files) {
    const result = await uploadToCloudinary(file.path);
    fs.unlinkSync(file.path);
    if (file.mimetype.startsWith('image/')) images.push(result.secure_url);
    else if (file.mimetype.startsWith('video/')) videos.push(result.secure_url);
  }
  // Update content fields
  content.title = title || content.title;
  content.description = description || content.description;
  content.instruction = instruction || content.instruction;
  content.caption = caption || content.caption;
  content.contentType = contentType || content.contentType;
  content.categories = categories || content.categories;
  content.tags = tags || content.tags;
  content.imageUrl = images.length > 0 ? images : content.imageUrl;
  content.videoUrl = videos.length > 0 ? videos : content.videoUrl;
  content.updatedAt = Date.now();
  await content.save();
  logger.info('Content updated', { id: content._id });
  res.json(new ApiResponse(200, content, 'Content updated successfully'));
});
// Delete content
exports.deleteContent = asyncHandler(async (req, res) => {
  const content = await ContentItem.findById(req.params.id);
  if (!content) {
    logger.warn(`Content not found for delete: ${req.params.id}`);
    throw new ApiError(404, 'Content not found');
  }
  const deleteMedia = async (urls, type) => {
    for (const url of urls) {
      const publicId = url.split('/').pop().split('.')[0];
      await deleteFromCloudinary(publicId, type);
    }
  };
  await deleteMedia(content.imageUrl, 'image');
  await deleteMedia(content.videoUrl, 'video');
  await content.deleteOne();
  logger.info('Content deleted', { id: content._id });
  res.json(new ApiResponse(200, null, 'Content deleted successfully'));
});

exports.getTrendingTemplates = asyncHandler(async (req, res) => {
  const trendingTemplates = await ContentItem.find({
    isTrending: true
  })
    .sort({ trendingScore: -1 })
    .limit(20)
    .select('title imageUrl contentType categories usageCount downloadCount trendingScore');

  logger.info('Fetched trending templates');
  res.json(new ApiResponse(200, trendingTemplates, 'Trending templates fetched successfully'));
});

// Increment view count
exports.incrementView = asyncHandler(async (req, res) => {
  const template = await ContentItem.findByIdAndUpdate(
    req.params.id,
    { $inc: { viewCount: 1 } },
    { new: true }
  );

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  logger.info('View count incremented', { id: template._id });
  res.json(new ApiResponse(200, { viewCount: template.viewCount }, 'View count updated'));
});

// Track download
exports.trackDownload = asyncHandler(async (req, res) => {
  // Update template download count
  const template = await ContentItem.findByIdAndUpdate(
    req.params.id,
    { $inc: { downloadCount: 1 } },
    { new: true }
  );

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  // Add to user's downloads
  await User.findByIdAndUpdate(req.user.id, {
    $push: {
      downloads: {
        contentId: req.params.id,
        downloadedAt: new Date()
      }
    }
  });

  logger.info('Download tracked', { templateId: template._id, userId: req.user.id });
  res.json(new ApiResponse(200, { downloadCount: template.downloadCount }, 'Download tracked successfully'));
});

// Get user's bookmarks
exports.getUserBookmarks = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate('bookmarks.contentId', 'title imageUrl contentType categories')
    .select('bookmarks');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  logger.info('Fetched user bookmarks', { userId: req.user.id });
  res.json(new ApiResponse(200, user.bookmarks, 'Bookmarks fetched successfully'));
});

// Add bookmark
exports.addBookmark = asyncHandler(async (req, res) => {
  const { contentId } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if already bookmarked
  const existingBookmark = user.bookmarks.find(
    bookmark => bookmark.contentId.toString() === contentId
  );

  if (existingBookmark) {
    throw new ApiError(400, 'Template already bookmarked');
  }

  // Add bookmark
  await User.findByIdAndUpdate(req.user.id, {
    $push: {
      bookmarks: {
        contentId: contentId,
        bookmarkedAt: new Date()
      }
    }
  });

  logger.info('Bookmark added', { contentId, userId: req.user.id });
  res.json(new ApiResponse(200, null, 'Bookmark added successfully'));
});

// Remove bookmark
exports.removeBookmark = asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  await User.findByIdAndUpdate(req.user.id, {
    $pull: {
      bookmarks: { contentId: contentId }
    }
  });

  logger.info('Bookmark removed', { contentId, userId: req.user.id });
  res.json(new ApiResponse(200, null, 'Bookmark removed successfully'));
});
