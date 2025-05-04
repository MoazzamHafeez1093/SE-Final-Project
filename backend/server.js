const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

// Debug environment variables
console.log("Environment variables loaded:");
console.log("MONGO_URL:", process.env.MONGO_URL ? "Present" : "Missing");
console.log("PORT:", process.env.PORT);
console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN);

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000"
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection with Retry Logic
const connectWithRetry = () => {
  console.log("Attempting to connect to MongoDB...");
  const mongoURI = process.env.MONGO_URL;
  console.log("Using MongoDB URI:", mongoURI);

  if (!mongoURI) {
    console.error("MongoDB URI is missing. Please check your .env file");
    process.exit(1);
  }

  mongoose
    .connect(mongoURI)
    .then(async() => {
      console.log("MongoDB Connected Successfully");
      
      // Clear mongoose models to prevent overwrite errors
      mongoose.models = {};
      mongoose.modelSchemas = {};
      
      // Initialize models after connection
      const User = require("./models/User");
      const Product = require("./models/Product");
      // ======== NEW CODE START ========
      // Create database indexes programmatically
      try {
        await Product.createIndexes();
        console.log("✅ Product indexes created successfully");
        await User.createIndexes();
        console.log("✅ User indexes created successfully");
      } catch (indexError) {
        console.error("❌ Index creation failed:", indexError);
      }
      // ======== NEW CODE END ========


      // Import routes
      const authRoutes = require("./routes/auth");
      const productRoutes = require("./routes/products");
      const cartRoutes = require("./routes/cart");

      // Routes
      app.use("/api/auth", authRoutes);
      app.use("/api/products", productRoutes);
      app.use("/api/cart", cartRoutes);

      // Serve static files from the React app
      app.use(express.static(path.join(__dirname, "../frontend/build")));

      // The "catchall" handler: for any request that doesn't
      // match one above, send back React's index.html file.
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
      });

      const PORT = process.env.PORT || 5001;
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
      console.log("Retrying connection in 5 seconds...");
      setTimeout(connectWithRetry, 5000);
    });
};

// Connect to MongoDB
connectWithRetry();
