const express = require("express");
const cors    = require("cors");
require("dotenv").config();
const connectDB  = require("./src/db/db");
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const autoCancelUnpaidOrders = require('./src/jobs/autoCancelOrders');

const errorHandler = require("./src/middleWare/errorHandler");

// Routes
const authRoute      = require("./src/route/authRoute");
const productRoute   = require("./src/route/productRoute");
const cartRoute      = require("./src/route/cartRoute");
const orderRoute     = require("./src/route/orderRoute");
const addressRoute   = require("./src/route/addressRoute");
const adminRoute     = require("./src/route/adminRoute");
const uploadRoute    = require('./src/route/uploadRoute');
const userRoute      = require("./src/route/userRoute");
const inventoryRoute = require("./src/route/inventoryRoute");
const chatRoute      = require('./src/route/chatRoute');
const paymentRoute   = require('./src/route/paymentRoute'); // ✅ VNPay
const voucherRoute = require("./src/route/voucherRoute");
const shippingRoute = require('./src/route/shippingRoute');


const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    },
});

connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
    origin: function(origin, callback) {
        // Development: cho phép tất cả
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
 
        // Production: chỉ cho phép domain cụ thể
        const allowedOrigins = [
            process.env.CLIENT_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
        ].filter(Boolean);
 
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.status(200).json({ status: "success", message: "Server running..." }));

app.use("/api/auth",             authRoute);
app.use("/api/products",         productRoute);
app.use("/api/cart",             cartRoute);
app.use("/api/orders",           orderRoute);
app.use("/api/addresses",        addressRoute);
app.use("/api/admin",            adminRoute);
app.use('/api/upload',           uploadRoute);
app.use('/api/banners',          require('./src/route/bannerRoute'));
app.use('/api/promotions',       require('./src/route/promotionRoute'));
app.use('/api/user',             userRoute);
app.use("/api/admin/inventory",  inventoryRoute);
app.use('/api/chat',             chatRoute);
app.use('/api/payment',          paymentRoute); // ✅ VNPay
app.use('/api/vouchers',         voucherRoute);
app.use('/api/shipping',         shippingRoute);
// ── 404 + Error handler ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ status: "error", message: "Route not found" }));
app.use(errorHandler);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const { setIo, registerChatHandlers } = require('./src/controller/chatController');
setIo(io); // ✅ inject io vào chatController để emit realtime

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
        const decoded      = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.userId = decoded.userId || decoded.id || decoded._id;
        socket.data.role   = decoded.role || 'user';
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', socket => registerChatHandlers(io, socket));
// ── Job: Tự động hủy đơn chưa thanh toán sau 30 phút ─────────────────────────
autoCancelUnpaidOrders();
setInterval(autoCancelUnpaidOrders, 5 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));