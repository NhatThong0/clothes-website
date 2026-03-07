const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            status: 'error',
            message: 'Yêu cầu quyền admin',
        });
    }
    next();
};

module.exports = requireAdmin;