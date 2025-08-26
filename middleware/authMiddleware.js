const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id,
      _id: decoded._id || decoded.id,
      email: decoded.email
    };
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({ message: 'Token invalid' });
  }
};

exports.adminOnly = (req, res, next) => {
  // console.log('Checking admin permissions for user:', req.user);
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // Fetch user from database to check role
  User.findById(userId).select('role').then(user => {
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admins only' });
    }
    next();
  }).catch(err => {
    console.error('Error fetching user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  });
};
