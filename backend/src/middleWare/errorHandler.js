const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors)
            .map(e => e.message)
            .join(', ');
        return res.status(400).json({
            status: 'error',
            message: 'Validation error',
            details: messages,
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            status: 'error',
            message: `${field} already exists`,
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid token',
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(403).json({
            status: 'error',
            message: 'Token expired',
        });
    }

    // Default error
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error',
    });
};

module.exports = errorHandler;
