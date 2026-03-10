const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/market");
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        process.exit(1);
    }
};

module.exports = () => mongoose.connect(process.env.MONGO_URI);