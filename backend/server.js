const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./src/db/db");
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const autoCancelUnpaidOrders = require('./src/jobs/autoCancelOrders');
const errorHandler = require("./src/middleWare/errorHandler");
const { startAutoConfirmCron } = require('./src/cron/autoConfirmOrders');

// Routes (Giữ nguyên các import của bạn)
const authRoute = require("./src/route/authRoute");
const productRoute = require("./src/route/productRoute");
const cartRoute = require("./src/route/cartRoute");
const orderRoute = require("./src/route/orderRoute");
const addressRoute = require("./src/route/addressRoute");
const adminRoute = require("./src/route/adminRoute");
const uploadRoute = require('./src/route/uploadRoute');
const userRoute = require("./src/route/userRoute");
const inventoryRoute = require("./src/route/inventoryRoute");
const chatRoute = require('./src/route/chatRoute');
const paymentRoute = require('./src/route/paymentRoute');
const voucherRoute = require("./src/route/voucherRoute");
const shippingRoute = require('./src/route/shippingRoute');
const notificationRoutes = require('./src/route/notificationRoutes');

const app = express();
const server = http.createServer(app);

// ── Socket.io Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    },
});

// Gán io vào app để có thể sử dụng ở các controller khác qua req.app.get('io')
app.set('io', io);

connectDB();
startAutoConfirmCron();

// ── CORS & Middleware ────────────────────────────────────────────────────────
const corsOptions = {
    origin: function(origin, callback) {
        if (process.env.NODE_ENV !== 'production') return callback(null, true);
        const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('CORS not allowed'));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes Registration ──────────────────────────────────────────────────────
app.get("/", (req, res) => res.status(200).json({ status: "success", message: "Server running..." }));

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
app.use('/api/chat', chatRoute);
app.use('/api/payment', paymentRoute);
app.use('/api/vouchers', voucherRoute);
app.use('/api/shipping', shippingRoute);
app.use('/api/notifications', notificationRoutes);
// ── Socket.IO Logic (Chat + Notification) ───────────────────────────────────
const { setIo, registerChatHandlers } = require('./src/controller/chatController');
setIo(io); 

// Middleware xác thực Socket
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.userId = decoded.userId || decoded.id || decoded._id;
        socket.data.role = decoded.role || 'user';
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    const userId = String(socket.data.userId);
    const role = socket.data.role;
    
    socket.join(`user:${userId}`);
    console.log(`[Socket 🔌] ID: ${socket.id} | User: ${userId} | Role: ${role} | Joined: user:${userId}`);
    
    if (role === 'admin') {
        socket.join('admin:global');
        console.log(`[Socket 🛡️] Admin ${userId} joined room: admin:global`);
    }

    // Đăng ký các handler cho Chat
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
    });
});


// ── Jobs & Error Handling ────────────────────────────────────────────────────
autoCancelUnpaidOrders();
setInterval(autoCancelUnpaidOrders, 5 * 60 * 1000);

app.use((req, res) => res.status(404).json({ status: "error", message: "Route not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));