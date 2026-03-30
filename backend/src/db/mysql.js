const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "thong1909",
    database: process.env.MYSQL_DATABASE || "market",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

const connectMySQL = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ MySQL connected successfully");
        connection.release();
    } catch (error) {
        console.error("❌ MySQL connection error:", error.message);
        // Don't exit process here unless absolutely necessary, maybe we want MongoDB to still work.
    }
};

module.exports = { pool, connectMySQL };
