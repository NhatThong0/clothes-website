const mongoose = require('mongoose');

async function dropLegacyProductIndexes() {
    try {
        const Product = require('../model/Product');
        const indexes = await Product.collection.indexes();

        const invalidIndexes = indexes.filter((index) => {
            const keys = Object.keys(index.key || {});
            return keys.includes('styleTags') && keys.includes('occasionTags');
        });

        for (const index of invalidIndexes) {
            try {
                await Product.collection.dropIndex(index.name);
                console.log(`Dropped invalid Product index: ${index.name}`);
            } catch (error) {
                console.warn(`Skip dropping Product index ${index.name}: ${error.message}`);
            }
        }
    } catch (error) {
        console.warn(`Product index cleanup skipped: ${error.message}`);
    }
}

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/market');
        await dropLegacyProductIndexes();
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
