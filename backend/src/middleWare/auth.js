const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Lấy token từ chuỗi "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'No token provided, authorization denied',
        });
    }

    try {
        // Sử dụng secret key từ file .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Lưu thông tin user vào request để các controller phía sau có thể dùng
        req.userId = decoded.userId;
        req.user = decoded;
        
        next(); // Cho phép đi tiếp sang controller
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or expired token',
        });
    }
};

// Export dưới dạng object để khớp với require('{ protect }')
module.exports = { protect };