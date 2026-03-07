const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./src/db/db");

// Import middleware
const errorHandler = require("./src/middleWare/errorHandler");

// Import routes
const authRoute = require("./src/route/authRoute");
const productRoute = require("./src/route/productRoute");
const cartRoute = require("./src/route/cartRoute");
const orderRoute = require("./src/route/orderRoute");
const addressRoute = require("./src/route/addressRoute");
const adminRoute = require("./src/route/adminRoute");
const uploadRoute = require('./src/route/uploadRoute');
const app = express();
const userRoute = require("./src/route/userRoute");
const inventoryRoute = require("./src/route/inventoryRoute");

// Connect to database
connectDB();

// Middleware
const corsOptions = {
    origin: function(origin, callback) {
        // Allow specific origins in development
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
            'http://127.0.0.1:3000'
        ];
        
        // In production, use specific origin from env
        if (process.env.NODE_ENV === 'production') {
            if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
                callback(null, true);
            } else {
                callback(new Error('CORS not allowed'));
            }
        } else {
            // In development, allow from list
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS not allowed'));
            }
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
    res.status(200).json({ status: "success", message: "Server running..." });
});

// API Routes
app.use("/api/auth", authRoute);
app.use("/api/products", productRoute);
app.use("/api/cart", cartRoute);
app.use("/api/orders", orderRoute);
app.use("/api/addresses", addressRoute);
app.use("/api/admin", adminRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/banners', require('./src/route/bannerRoute'));
app.use('/api/promotions', require('./src/route/promotionRoute'));
app.use('/api/user', userRoute);
app.use("/api/admin/inventory", inventoryRoute);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: "error", message: "Route not found" });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
