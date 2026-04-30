const express = require('express');
const router = express.Router();
const {
    register,
    verifyRegisterOtp,
    login,
    socialLogin,
    getCurrentUser,
    updateProfile,
    changePassword,
} = require('./auth.controller');
const authenticateToken = require('../../middleware/authenticateToken');

// Public routes
router.post('/register', register);
router.post('/register/verify-otp', verifyRegisterOtp);
router.post('/login', login);
router.post('/social-login', socialLogin);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
