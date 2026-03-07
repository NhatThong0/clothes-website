require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../model/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existing = await User.findOne({ email: 'admin@example.com' });
        if (existing) {
            console.log('Admin already exists');
            process.exit(0);
        }

        const admin = new User({
            name: 'Admin',
            email: 'admin@example.com',
            password: 'admin123456',
            role: 'admin',
        });

        await admin.save();
        console.log('✅ Admin created successfully');
        console.log('Email: admin@example.com');
        console.log('Password: admin123456');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

createAdmin();