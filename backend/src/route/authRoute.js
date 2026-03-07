const express = require('express');
const router = express.Router();
const {
    register,
    login,
    getCurrentUser,
    updateProfile,
    changePassword,
} = require('../controller/authController');
const authenticateToken = require('../middleWare/authenticateToken');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
