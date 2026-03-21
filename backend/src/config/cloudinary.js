const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Product images ────────────────────────────────────────────────────────────
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'fashion-hub/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
});

// ── Avatar images ─────────────────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'fashion-hub/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face', quality: 'auto' },
        ],
        public_id: (req) => `avatar_${req.userId}_${Date.now()}`,
    },
});

// ── Return / hoàn trả images ──────────────────────────────────────────────────
const returnStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'fashion-hub/returns',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, quality: 'auto' }],
    },
});

const upload        = multer({ storage: productStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatar  = multer({ storage: avatarStorage,  limits: { fileSize: 5 * 1024 * 1024 } });
const uploadReturn  = multer({ storage: returnStorage,  limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { cloudinary, upload, uploadAvatar, uploadReturn };