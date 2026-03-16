const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'No token provided, authorization denied',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.userId = decoded.userId;
        req.user   = decoded;
        next();
    } catch (error) {
        // ✅ Phân biệt token hết hạn vs token sai
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token đã hết hạn, vui lòng đăng nhập lại',
                code: 'TOKEN_EXPIRED',
            });
        }
        return res.status(401).json({
            status: 'error',
            message: 'Token không hợp lệ',
            code: 'TOKEN_INVALID',
        });
    }
};

module.exports = authenticateToken;