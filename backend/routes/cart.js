const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const auth = require('../middleware/auth');

// Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images description category');
    
    if (!cart) {
      return res.json({ success: true, items: [] });
    }
    
    res.json({ success: true, items: cart.items });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, message: 'Error fetching cart' });
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(item => item.product.toString() === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({ product: productId });
    }

    await cart.save();
    
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name price images description category');
    
    res.json({ success: true, items: populatedCart.items });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Error adding to cart' });
  }
});

// Remove item from cart
router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();
    
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name price images description category');
    
    res.json({ success: true, items: populatedCart.items });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Error removing from cart' });
  }
});

// Clear user's cart
router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    cart.items = [];
    await cart.save();
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Error clearing cart' });
  }
});

module.exports = router; 