const User = require('../model/User');

const authorizeAdmin = async (req, res, next) => {
    try {
        // Check if user is authenticated (should be called after authenticateToken middleware)
        if (!req.userId) {
            return res.status(401).json({
                status: 'error',
                message: 'No token provided, authorization denied',
            });
        }

        // Get user from database to check role
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Admin privileges required',
            });
        }

        // Attach user to request object for later use
        req.admin = user;
        next();
    } catch (error) {
        console.error('Admin authorization error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Server error during authorization',
        });
    }
};

module.exports = authorizeAdmin;
