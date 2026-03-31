const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const connectDB = require('./src/db/db');
const { connectMySQL } = require('./src/db/mysql');
const errorHandler = require('./src/middleware/errorHandler');
const autoCancelUnpaidOrders = require('./src/jobs/autoCancelOrders');
const { startAutoConfirmCron } = require('./src/cron/autoConfirmOrders');
const { registerRoutes } = require('./src/app/registerRoutes');
const { chat } = require('./src/modules');

const app = express();
const server = http.createServer(app);

// Expose io so controllers can emit events via req.app.get('io').
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});
app.set('io', io);

connectDB();
connectMySQL();
startAutoConfirmCron();

const corsOptions = {
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS not allowed'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

registerRoutes(app);

const { setIo, registerChatHandlers } = chat.controller;
setIo(io);

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
  console.log(
    `[Socket] ID: ${socket.id} | User: ${userId} | Role: ${role} | Joined: user:${userId}`,
  );

  if (role === 'admin') {
    socket.join('admin:global');
    console.log(`[Socket] Admin ${userId} joined room: admin:global`);
  }

  // Register chat handlers for this socket connection.
  registerChatHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

autoCancelUnpaidOrders();
setInterval(autoCancelUnpaidOrders, 5 * 60 * 1000);

app.use((req, res) =>
  res.status(404).json({ status: 'error', message: 'Route not found' }),
);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
