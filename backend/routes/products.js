const express = require('express');
const Product = require('../models/Product');
const { body, validationResult } = require('express-validator');
const verifyToken = require('../middleware/verifytoken');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
});

// Create a new product
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    console.log('Creating new product with data:', req.body);
    console.log('Uploaded files:', req.files);
    
    // Extract form data
    const {
      name,
      price,
      description,
      category,
      size,
      color,
      location,
      contactNumber
    } = req.body;

    // Validate required fields
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }

    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid price'
      });
    }

    if (!contactNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Contact number is required'
      });
    }

    // Validate category
    const validCategories = ['shoes', 'clothes', 'accessories', 'electronics', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Get image paths (relative to the uploads directory)
    const images = req.files.map(file => `/uploads/${file.filename}`);
    console.log('Processed image paths:', images);

    // Create product
    const product = new Product({
      name: name.trim(),
      price: parseFloat(price),
      description: description?.trim() || '',
      category: category?.trim() || 'other',
      size: size?.trim() || '',
      color: color?.trim() || '',
      location: location?.trim() || '',
      contactNumber: contactNumber.trim(),
      images,
      seller: req.user.id
    });

    console.log('Product object before save:', product);
    
    await product.save();
    console.log('Product saved successfully with ID:', product._id);

    // Populate seller information
    const populatedProduct = await Product.findById(product._id)
      .populate('seller', 'name email');
    console.log('Populated product:', populatedProduct);

    res.status(201).json({ 
      success: true, 
      product: populatedProduct,
      message: 'Product added successfully!' 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Clean up uploaded files if product creation fails
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      });
    }

    // Send specific error message
    let errorMessage = 'Failed to add product. Please try again.';
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
    }

    res.status(400).json({ 
      success: false, 
      message: errorMessage
    });
  }
});

// GET all products (public access)
router.get('/public', async (req, res) => {
  try {
    console.log('Fetching public products...');
    console.log('Current filters:', {
      status: 'approved',
      isActive: true,
      soldAt: { $exists: false } // Exclude sold items
    });
    
    const products = await Product.find({ 
      status: 'approved',
      isActive: true,
      soldAt: { $exists: false } // Exclude sold items
    })
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    console.log(`Found ${products.length} products`);
    console.log('First product sample:', products[0] ? {
      id: products[0]._id,
      name: products[0].name,
      seller: products[0].seller
    } : 'No products found');

    res.json(products);
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// GET all products (authenticated access)
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching authenticated products...');
    console.log('Current filters:', {
      status: 'approved',
      isActive: true
    });
    
    const products = await Product.find({ 
      status: 'approved',
      isActive: true 
    })
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    console.log(`Found ${products.length} products`);
    console.log('First product sample:', products[0] ? {
      id: products[0]._id,
      name: products[0].name,
      seller: products[0].seller
    } : 'No products found');

    res.json({ 
      success: true, 
      products,
      message: 'Products fetched successfully' 
    });
  } catch (error) {
    console.error('Error fetching authenticated products:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching products',
      error: error.message 
    });
  }
});

// Get user's own products (all statuses)
router.get('/my-products', auth, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id })
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 }); // Sort by newest first
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending products (admin only)
router.get('/pending', [auth, adminAuth], async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending' })
      .populate('seller', 'name email');
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update product status (admin only)
router.put('/:id/status', [auth, adminAuth], async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be either "approved" or "rejected"' 
      });
    }

    // Find and update the product
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Update the status
    product.status = status;
    await product.save();

    // Return the updated product
    res.json({ 
      success: true, 
      product,
      message: `Product ${status} successfully` 
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update product status' 
    });
  }
});

// Toggle product active status (seller or admin only)
router.put('/:id/toggle-active', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if user is the seller or an admin
    if (product.seller.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to modify this product' 
      });
    }

    // Toggle the active status
    product.isActive = !product.isActive;
    await product.save();

    res.json({ 
      success: true, 
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
      product 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a product
router.put('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user is the seller or an admin
    if (product.seller.toString() !== req.user.id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this product' });
    }

    // Update product fields
    const {
      name,
      price,
      description,
      category,
      size,
      color,
      location,
      contactNumber
    } = req.body;

    // Validate required fields
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }

    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid price'
      });
    }

    if (!contactNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Contact number is required'
      });
    }

    // Validate category
    const validCategories = ['shoes', 'clothes', 'accessories', 'electronics', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Update product
    product.name = name.trim();
    product.price = parseFloat(price);
    product.description = description?.trim() || '';
    product.category = category?.trim() || 'other';
    product.size = size?.trim() || '';
    product.color = color?.trim() || '';
    product.location = location?.trim() || '';
    product.contactNumber = contactNumber.trim();

    await product.save();

    res.json({ 
      success: true, 
      product,
      message: 'Product updated successfully' 
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update product',
      error: error.message 
    });
  }
});

// Delete a product
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user is the seller or an admin
    if (product.seller.toString() !== req.user.id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    // Delete product images from the filesystem
    if (product.images && product.images.length > 0) {
      product.images.forEach(imagePath => {
        const fullPath = path.join(process.cwd(), imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    // Delete the product from the database
    await Product.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete product',
      error: error.message 
    });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { query, category, minPrice, maxPrice } = req.query;
    
    // Build search query
    const searchQuery = {
      status: 'approved',
      isActive: true,
      soldAt: { $exists: false } // Exclude sold items
    };

    // Add text search if query exists
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    // Add category filter if provided
    if (category) {
      searchQuery.category = category;
    }

    // Add price range if provided
    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(searchQuery)
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products,
      message: 'Search results fetched successfully'
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
});

// Get a single product by ID (This should be the last GET route)
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching product with ID:', req.params.id);
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name email');
    
    if (!product) {
      console.log('Product not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    console.log('Found product:', product);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching product',
      error: error.message 
    });
  }
});

// Checkout route
router.post('/checkout', auth, async (req, res) => {
  try {
    const { productId, shippingAddress, paymentInfo } = req.body;

    // Validate product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if product is still available at the exact moment of purchase
    if (product.status === 'sold' || !product.isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'This product is no longer available. It may have been purchased by another user.' 
      });
    }

    if (product.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'This product is not available for purchase' 
      });
    }

    // Simple validation of payment info (just checking if fields exist)
    if (!paymentInfo || !paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment information'
      });
    }

    // Use findOneAndUpdate to atomically check and update the product status
    const updatedProduct = await Product.findOneAndUpdate(
      { 
        _id: productId,
        status: 'approved',
        isActive: true
      },
      {
        $set: {
          status: 'sold',
          buyer: req.user.id,
          soldAt: new Date(),
          shippingAddress: shippingAddress,
          isActive: false
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(400).json({
        success: false,
        message: 'This product is no longer available. It may have been purchased by another user.'
      });
    }

    res.json({ 
      success: true, 
      message: 'Purchase completed successfully',
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process purchase',
      error: error.message 
    });
  }
});

// Admin stats: total users and products
router.get('/admin/stats', [auth, adminAuth], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    res.json({ success: true, totalUsers, totalProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats', error: error.message });
  }
});

module.exports = router;
