const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./src/db/db");
const http    = require('http');
const { Server } = require('socket.io');
const jwt     = require('jsonwebtoken');

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
const { startChatChangeStream } = require('./src/chatChangeStream');

// Create HTTP server and Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    },
});
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

// ── Mount chat REST route ────────────────────────────────────────────────────
const chatRoute = require('./src/route/chatRoute');
app.use('/api/chat', chatRoute);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: "error", message: "Route not found" });
});

// Error handling middleware (must be last)
app.use(errorHandler);
// Socket.IO authentication middleware
// ── Socket auth middleware ────────────────────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.userId = decoded.userId || decoded.id || decoded._id;
        socket.data.role   = decoded.role || 'user';
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});
// ── Register chat handlers ───────────────────────────────────────────────────
const { registerChatHandlers } = require('./src/controller/chatController');
io.on('connection', socket => {
    registerChatHandlers(io, socket);
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
