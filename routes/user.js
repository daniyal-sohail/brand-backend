const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const {
    getProfile,
    updateProfile,
    getUserTemplateHistory,
    getUserDownloads,
    getDashboardStats,
    // Canva access request functions
    requestCanvaAccess,
    getCanvaAccessRequestStatus,
    // Admin functions
    getAllUsers,
    getUserById,
    updateUserRole,
    deleteUser,
    getUserStats
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/authMiddleware');
const { ensureDatabaseConnection } = require('../middleware/databaseMiddleware');

// Apply database connection middleware to all user routes
router.use(ensureDatabaseConnection);

// Multer memory storage to avoid EROFS on serverless
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// All routes are protected (require authentication)
router.use(protect);

// User routes (regular users)
router.get('/me', getProfile);
router.put('/me', upload.single('profileImage'), updateProfile);

router.get('/template-history', getUserTemplateHistory);
router.get('/downloads', getUserDownloads);
router.get('/dashboard-stats', getDashboardStats);

// Canva access request routes
router.post('/canva/request-access', requestCanvaAccess);
router.get('/canva/access-status', getCanvaAccessRequestStatus);

// Admin routes (require admin role)
router.get('/admin/all', adminOnly, getAllUsers);
router.get('/admin/user-stats', adminOnly, getUserStats);
router.get('/admin/:id', adminOnly, getUserById);
router.put('/admin/:id/role', adminOnly, updateUserRole);
router.delete('/admin/:id', adminOnly, deleteUser);

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 5MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error: ' + error.message
        });
    }

    if (error.message === 'Only image files are allowed') {
        return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
        });
    }

    next(error);
});

module.exports = router;