const User = require('../model/User');
const Cart = require('../model/Cart');
const { generateToken } = require('../utils/jwtToken');
const { validateEmail, validatePassword, validateName } = require('../utils/validators');

// Register
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields',
            });
        }

        if (!validateName(name)) {
            return res.status(400).json({
                status: 'error',
                message: 'Name must be at least 2 characters',
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format',
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters',
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Passwords do not match',
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Email already registered',
            });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
        });

        await user.save();

        // Create empty cart for user
        const cart = new Cart({
            userId: user._id,
            items: [],
        });
        await cart.save();

        // Generate token
        const token = generateToken(user._id, user.email, user.role);

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: {
                user: userResponse,
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email and password',
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format',
            });
        }

        // Find user and compare password
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
            });
        }

        const isPasswordValid = await user.matchPassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
            });
        }

        // Generate token
        const token = generateToken(user._id, user.email, user.role);

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: userResponse,
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId).populate('addresses');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, phone, avatar } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                name: name || undefined,
                phone: phone || undefined,
                avatar: avatar || undefined,
                updatedAt: new Date(),
            },
            { new: true, runValidators: true }
        ).populate('addresses');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// Change password
exports.changePassword = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all password fields',
            });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                status: 'error',
                message: 'New password must be at least 6 characters',
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Passwords do not match',
            });
        }

        // Get user with password field
        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        // Verify current password
        const isPasswordValid = await user.matchPassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect',
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'Password changed successfully',
        });
    } catch (error) {
        next(error);
    }
};
