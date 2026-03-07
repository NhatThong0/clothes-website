const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/model/User');
const Category = require('./src/model/Category');
const Product = require('./src/model/Product');

const seedDatabase = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/market');
        console.log('📦 Connected to MongoDB for seeding...');

        // Clear existing data
        await User.deleteMany({});
        await Category.deleteMany({});
        await Product.deleteMany({});
        console.log('🧹 Cleared existing data');

        // Seed Users
        const users = await User.create([
            {
                name: 'Admin User',
                email: 'admin@example.com',
                password: 'admin123',
                phone: '0123456789',
                role: 'admin',
            },
            {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                phone: '0987654321',
                role: 'customer',
            },
            {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password: 'password123',
                phone: '0912345678',
                role: 'customer',
            },
        ]);
        console.log('✅ Created 3 users');

        // Seed Categories
        const categories = await Category.create([
            {
                name: 'Áo năng lượng',
                description: 'Quần áo thoáng mát, thoải mái thích hợp cho hoạt động thể thao',
                image: '/images/category-sports.jpg',
            },
            {
                name: 'Quần',
                description: 'Quần jean, quần âu và các loại quần khác',
                image: '/images/category-pants.jpg',
            },
            {
                name: 'Váy',
                description: 'Váy đầm và các loại váy thời trang',
                image: '/images/category-dresses.jpg',
            },
            {
                name: 'Phụ kiện',
                description: 'Mũ, túi, thắt lưng và các phụ kiện khác',
                image: '/images/category-accessories.jpg',
            },
        ]);
        console.log('✅ Created 4 categories');

        // Seed Products
        const products = await Product.create([
            {
                name: 'Áo Phông Cotton Cao Cấp',
                description: 'Áo phông 100% cotton, chất liệu mềm mại, thoáng khí. Phù hợp mặc hàng ngày.',
                price: 199000,
                discount: 10,
                category: categories[0]._id,
                images: ['/images/product-1.jpg'],
                stock: 50,
                colors: ['White', 'Black', 'Navy'],
                sizes: ['S', 'M', 'L', 'XL'],
                rating: 4.5,
                features: ['100% Cotton', 'Thoáng khí', 'Không nhăn'],
            },
            {
                name: 'Quần Jean Nam Slimfit',
                description: 'Quần jean nam kiểu slimfit, chất vải denim cao cấp, bền bỉ và thời trang.',
                price: 499000,
                discount: 15,
                category: categories[1]._id,
                images: ['/images/product-2.jpg'],
                stock: 30,
                colors: ['Dark Blue', 'Light Blue', 'Black'],
                sizes: ['30', '31', '32', '33', '34'],
                rating: 4.7,
                features: ['Denim cao cấp', 'Kiểu slimfit', 'Bền bỉ'],
            },
            {
                name: 'Váy Đầm Nữ Thời Trang',
                description: 'Váy đầm nữ kiểu dáng thời trang, chất vải mềm mại, cửa hàng gợi ý cho các buổi đi chơi.',
                price: 599000,
                discount: 20,
                category: categories[2]._id,
                images: ['/images/product-3.jpg'],
                stock: 25,
                colors: ['Red', 'Blue', 'Pink', 'Black'],
                sizes: ['XS', 'S', 'M', 'L', 'XL'],
                rating: 4.6,
                features: ['Kiểu dáng thời trang', 'Chất vải mềm', 'Nhiều màu sắc'],
            },
            {
                name: 'Túi Xách Nữ Cao Cấp',
                description: 'Túi xách nữ sang trọng, chất liệu PU bền bỉ, thiết kế hiện đại và tiện dụng.',
                price: 799000,
                discount: 5,
                category: categories[3]._id,
                images: ['/images/product-4.jpg'],
                stock: 20,
                colors: ['Red', 'Brown', 'Black'],
                sizes: ['One Size'],
                rating: 4.8,
                features: ['Chất liệu PU', 'Bền bỉ', 'Thiết kế hiện đại'],
            },
            {
                name: 'Áo Khoác Gió Nam',
                description: 'Áo khoác gió nam chống nước, chất liệu tốt, có túi đựng và có nắp che nắng.',
                price: 699000,
                discount: 12,
                category: categories[0]._id,
                images: ['/images/product-5.jpg'],
                stock: 35,
                colors: ['Navy', 'Black', 'Green'],
                sizes: ['S', 'M', 'L', 'XL', 'XXL'],
                rating: 4.4,
                features: ['Chống nước', 'Có túi', 'Có nắp che nắng'],
            },
            {
                name: 'Mũ Lưỡi Trai Thời Trang',
                description: 'Mũ lưỡi trai thành phố, thiết kế tinh tế, phù hợp khi ra nắng hoặc đi chơi.',
                price: 149000,
                discount: 8,
                category: categories[3]._id,
                images: ['/images/product-6.jpg'],
                stock: 60,
                colors: ['Black', 'White', 'Beige', 'Navy'],
                sizes: ['Free'],
                rating: 4.3,
                features: ['Thành phố', 'Tinh tế', 'Nhiều màu'],
            },
        ]);
        console.log('✅ Created 6 products');

        console.log('\n✅ Database seeding completed successfully!');
        console.log('\nTest accounts:');
        console.log('  Admin: admin@example.com / admin123');
        console.log('  User: john@example.com / password123');
        console.log('  User: jane@example.com / password123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error.message);
        process.exit(1);
    }
};

seedDatabase();
