const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization'); // Get Authorization header

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    req.user = decoded.userId; // Add userId to request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = verifyToken;
