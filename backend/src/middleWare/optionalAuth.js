'use strict';
const jwt = require('jsonwebtoken');

const optionalAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.userId = decoded.userId;
      req.user   = decoded;
    } catch { /* ignore invalid/expired token */ }
  }
  next();
};

module.exports = optionalAuth;
