const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Double-check admin status from database
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during admin verification' 
    });
  }
}; 