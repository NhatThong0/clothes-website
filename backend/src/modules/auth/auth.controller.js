const axios = require('axios');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../../model/User');
const { pool } = require('../../db/mysql');
const Cart = require('../../model/Cart');
const { generateToken } = require('../../utils/jwtToken');
const { validateEmail, validatePassword, validateName } = require('../../utils/validators');
const { notifyAdminNewUser } = require('../notification/notification.controller');
const { syncUserLoyaltySnapshot } = require('../loyalty/loyalty.service');
const { sendRegistrationOtp } = require('../../utils/email');

const OTP_EXPIRES_MINUTES = 10;

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function sanitizeUser(user) {
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailOtp;
    return userResponse;
}

async function createCartIfMissing(userId) {
    const existingCart = await Cart.findOne({ userId });
    if (existingCart) return;

    const cart = new Cart({
        userId,
        items: [],
    });
    await cart.save();
}

async function initUserSideEffects(user, req) {
    await syncUserLoyaltySnapshot(user._id.toString()).catch((err) => {
        console.error('[Loyalty] init snapshot failed:', err.message);
    });

    try {
        await pool.query(
            'INSERT INTO users (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [user._id.toString(), user.name, user.email, user.password || null, user.role || 'customer', new Date()]
        );
        console.log('User saved to MySQL successfully');
    } catch (mysqlErr) {
        console.error('MySQL Save Error:', mysqlErr.message);
    }

    await createCartIfMissing(user._id);
    await notifyAdminNewUser(user, req);
}

async function issueRegistrationOtp(user) {
    const code = generateOtp();
    user.emailOtp = {
        code,
        expiresAt: new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000),
        attempts: 0,
    };
    await user.save();
    await sendRegistrationOtp(user.email, code);
}

// Register: create/update an unverified account and send an OTP email.
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

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

        const existingUser = await User.findOne({ email }).select('+password +emailOtp.code +emailOtp.expiresAt +emailOtp.attempts');
        if (existingUser && existingUser.emailVerified !== false) {
            return res.status(400).json({
                status: 'error',
                message: 'Email already registered',
            });
        }

        const user = existingUser || new User({ email });
        user.name = name;
        user.password = password;
        user.authProvider = 'local';
        user.emailVerified = false;
        user.updatedAt = new Date();

        await issueRegistrationOtp(user);

        res.status(existingUser ? 200 : 201).json({
            status: 'success',
            message: 'OTP has been sent to your email',
            data: {
                email: user.email,
                requiresOtp: true,
                expiresInMinutes: OTP_EXPIRES_MINUTES,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.verifyRegisterOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email and OTP',
            });
        }

        const user = await User.findOne({ email }).select('+password +emailOtp.code +emailOtp.expiresAt +emailOtp.attempts');

        if (!user || user.emailVerified !== false) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid registration request',
            });
        }

        if (!user.emailOtp?.code || !user.emailOtp?.expiresAt || user.emailOtp.expiresAt < new Date()) {
            return res.status(400).json({
                status: 'error',
                message: 'OTP has expired. Please register again to receive a new code',
            });
        }

        if (user.emailOtp.attempts >= 5) {
            return res.status(429).json({
                status: 'error',
                message: 'Too many incorrect OTP attempts. Please request a new code',
            });
        }

        if (String(user.emailOtp.code) !== String(otp).trim()) {
            user.emailOtp.attempts += 1;
            await user.save();
            return res.status(400).json({
                status: 'error',
                message: 'Invalid OTP code',
            });
        }

        user.emailVerified = true;
        user.emailOtp = undefined;
        user.updatedAt = new Date();
        await user.save();
        await initUserSideEffects(user, req);

        const token = generateToken(user._id, user.email, user.role);

        res.status(200).json({
            status: 'success',
            message: 'Email verified successfully',
            data: {
                user: sanitizeUser(user),
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

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
            });
        }

        if (user.emailVerified === false) {
            return res.status(403).json({
                status: 'error',
                message: 'Please verify your email before logging in',
            });
        }

        const isPasswordValid = await user.matchPassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
            });
        }

        const token = generateToken(user._id, user.email, user.role);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: sanitizeUser(user),
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

async function getSocialProfile(provider, accessToken) {
    if (provider === 'google') {
        const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        return {
            id: response.data.sub,
            name: response.data.name,
            email: response.data.email,
            avatar: response.data.picture,
        };
    }

    if (provider === 'facebook') {
        const response = await axios.get('https://graph.facebook.com/me', {
            params: {
                fields: 'id,name,email,picture.type(large)',
                access_token: accessToken,
            },
        });

        return {
            id: response.data.id,
            name: response.data.name,
            email: response.data.email,
            avatar: response.data.picture?.data?.url,
        };
    }

    return null;
}

function getGoogleAllowedAudiences() {
    const raw = process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '';
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

async function getGoogleProfileFromIdToken(idToken) {
    const allowedAudiences = getGoogleAllowedAudiences();
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
        idToken,
        audience: allowedAudiences.length ? allowedAudiences : undefined,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) return null;
    return {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        avatar: payload.picture,
    };
}

exports.socialLogin = async (req, res, next) => {
    try {
        const { provider, accessToken, idToken } = req.body;

        if (!['google', 'facebook'].includes(provider)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid social login request',
            });
        }

        if (provider === 'facebook' && !accessToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing accessToken for facebook login',
            });
        }

        if (provider === 'google' && !accessToken && !idToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing idToken or accessToken for google login',
            });
        }

        const profile =
            provider === 'google' && idToken
                ? await getGoogleProfileFromIdToken(idToken)
                : await getSocialProfile(provider, accessToken);

        if (!profile?.email) {
            return res.status(400).json({
                status: 'error',
                message: 'Social account does not provide an email address',
            });
        }

        let user = await User.findOne({ email: profile.email }).select('+password');
        const isNewUser = !user;

        if (!user) {
            user = new User({
                name: profile.name || profile.email.split('@')[0],
                email: profile.email,
                avatar: profile.avatar || null,
                authProvider: provider,
                socialId: profile.id,
                emailVerified: true,
            });
        } else {
            user.name = user.name || profile.name;
            user.avatar = user.avatar || profile.avatar || null;
            user.socialId = user.socialId || profile.id;
            user.emailVerified = true;
            user.updatedAt = new Date();
        }

        await user.save();

        if (isNewUser) {
            await initUserSideEffects(user, req);
        } else {
            await createCartIfMissing(user._id);
        }

        const token = generateToken(user._id, user.email, user.role);

        res.status(200).json({
            status: 'success',
            message: 'Social login successful',
            data: {
                user: sanitizeUser(user),
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
            { returnDocument: 'after', runValidators: true }
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

        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        if (!user.password) {
            return res.status(400).json({
                status: 'error',
                message: 'This account does not have a password yet',
            });
        }

        const isPasswordValid = await user.matchPassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect',
            });
        }

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
