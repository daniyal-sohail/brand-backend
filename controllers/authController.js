const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { body, validationResult } = require('express-validator');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');
const { generateVerificationToken, generateVerificationTokenExpiry, isTokenExpired } = require('../utils/verificationToken');
const { createVerificationEmailTemplate, createResendVerificationEmailTemplate } = require('../utils/emailTemplates');

// Send verification email
const sendVerificationEmail = async (user, isResend = false) => {
  const verificationToken = generateVerificationToken();
  const verificationTokenExpiry = generateVerificationTokenExpiry();

  // Update user with new verification token
  await User.findByIdAndUpdate(user._id, {
    verificationToken,
    verificationTokenExpiry
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const emailTemplate = isResend
    ? createResendVerificationEmailTemplate(user.name, verificationUrl)
    : createVerificationEmailTemplate(user.name, verificationUrl);

  await sendEmail({
    to: user.email,
    subject: isResend ? 'New Verification Email - Brand Appeal' : 'Verify Your Email - Brand Appeal',
    html: emailTemplate
  });

  logger.info('Verification email sent', { userId: user._id, email: user.email, isResend });
};

exports.register = asyncHandler(async (req, res) => {
  let { email, password, name, role = 'USER' } = req.body;
  password = await bcrypt.hash(password, 10);

  const user = await User.create({ email, password, name, role });

  // Send verification email
  await sendVerificationEmail(user);

  logger.info('User registered', { id: user._id });
  res.status(201).json(new ApiResponse(201, {
    ...user._doc,
    password: undefined,
    verificationToken: undefined,
    verificationTokenExpiry: undefined
  }, 'Registration successful. Please check your email to verify your account.'));
});

// Login validation middleware
exports.loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.login = [
  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Login validation failed', errors.array());
      return res.status(400).json(new ApiResponse(400, null, 'Validation error', errors.array()));
    }
    next();
  },
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    logger.info('Login attempt', { email });

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      logger.warn('Invalid email');
      throw new ApiError(401, 'Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn('Invalid password');
      throw new ApiError(401, 'Invalid credentials');
    }

    // Check if user is verified
    if (!user.isVerified) {
      logger.warn('Unverified user login attempt', { userId: user._id });
      throw new ApiError(403, 'Please verify your email address before logging in. Check your email for verification link or request a new one.');
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_TIMEOUT }
    );

    logger.info('Login successful', { id: user._id });
    res.json(new ApiResponse(200, {
      accessToken: token,
      user: {
        ...user._doc,
        password: undefined,
        verificationToken: undefined,
        verificationTokenExpiry: undefined
      }
    }, 'Login successful'));
  })
];

// Verify email
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ApiError(400, 'Verification token is required');
  }

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    throw new ApiError(400, 'Invalid verification token');
  }

  if (isTokenExpired(user.verificationTokenExpiry)) {
    // Clear expired token
    await User.findByIdAndUpdate(user._id, {
      verificationToken: undefined,
      verificationTokenExpiry: undefined
    });
    throw new ApiError(400, 'Verification token has expired. Please request a new verification email.');
  }

  // Mark user as verified and clear verification token
  await User.findByIdAndUpdate(user._id, {
    isVerified: true,
    verificationToken: undefined,
    verificationTokenExpiry: undefined
  });

  logger.info('Email verified', { userId: user._id });
  res.json(new ApiResponse(200, null, 'Email verified successfully. You can now log in to your account.'));
});

// Resend verification email
exports.resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  // Check if there's a recent verification email (prevent spam)
  if (user.verificationTokenExpiry && !isTokenExpired(user.verificationTokenExpiry)) {
    const timeLeft = Math.ceil((new Date(user.verificationTokenExpiry) - new Date()) / (1000 * 60)); // minutes
    throw new ApiError(429, `Please wait ${timeLeft} minutes before requesting another verification email.`);
  }

  // Send new verification email
  await sendVerificationEmail(user, true);

  logger.info('Verification email resent', { userId: user._id });
  res.json(new ApiResponse(200, null, 'Verification email sent successfully. Please check your email.'));
});

// Check verification status
exports.checkVerificationStatus = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const user = await User.findOne({ email }).select('isVerified');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(new ApiResponse(200, { isVerified: user.isVerified }, 'Verification status retrieved successfully'));
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  logger.info('User logged out');
  res.json(new ApiResponse(200, null, 'Logout successful'));
});