const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");

// Check if model exists before creating it
let User;
try {
  User = mongoose.model('User');
} catch (e) {
  const UserSchema = new mongoose.Schema({
    name: { 
      type: String, 
      required: [true, 'Please provide your name'], 
      trim: true 
    },
    email: { 
      type: String, 
      required: [true, 'Please provide your email'], 
      unique: true, 
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'] 
    },
    password: { 
      type: String, 
      required: [true, 'Please provide a password'], 
      minlength: [6, 'Password must be at least 6 characters long']
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  }, { 
    collection: 'users',
    timestamps: true 
  });

  // Hash password before saving
  UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (err) {
      next(err);
    }
  });

  // Compare password for login
  UserSchema.methods.comparePassword = async function (enteredPassword) {
    try {
      return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  };

  // Static method to find user by credentials
  UserSchema.statics.findByCredentials = async function(email, password) {
    const user = await this.findOne({ email });
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    return user;
  };

  User = mongoose.model('User', UserSchema);
}

module.exports = User;
