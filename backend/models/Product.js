const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    required: true
  }],
  category: {
    type: String,
    enum: ['shoes', 'clothes', 'accessories', 'electronics', 'other'],
    default: 'other'
  },
  size: {
    type: String,
    trim: true,
    default: ''
  },
  color: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'sold'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  soldAt: {
    type: Date
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
