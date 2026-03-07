const jwt = require('jsonwebtoken');

const generateToken = (userId, userEmail, role = 'customer') => {
    const token = jwt.sign(
        { userId, email: userEmail, role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
    return token;
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = { generateToken, verifyToken };
