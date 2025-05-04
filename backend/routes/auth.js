const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const verifyToken = require('../middleware/verifytoken');
const auth = require('../middleware/auth');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check password using model's comparePassword method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Create JWT token
    const payload = {
      id: user._id,
      isAdmin: user.isAdmin
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Admin registration
router.post('/register-admin', async (req, res) => {
  try {
    const { name, email, password, adminKey } = req.body;

    // Check for admin key
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid admin key' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Create new admin user
    user = new User({
      name,
      email,
      password,
      isAdmin: true
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Create new user - password will be hashed by pre-save middleware
    user = new User({
      name,
      email,
      password
    });

    // Save user
    await user.save();

    // Create JWT token
    const payload = {
      id: user._id,
      isAdmin: user.isAdmin
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Verify token endpoint
router.get('/verify', auth, async (req, res) => {
  try {
    // If we get here, the token is valid (auth middleware passed)
    res.status(200).json({ message: 'Token is valid' });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying token' });
  }
});

module.exports = router;
