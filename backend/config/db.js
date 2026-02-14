const mysql = require('mysql2');
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Only log database config in development
if (NODE_ENV === 'development') {
    console.log("📦 Database Configuration:");
    console.log("   Host:", process.env.DB_HOST);
    console.log("   Port:", process.env.DB_PORT || 3306);
    console.log("   User:", process.env.DB_USER);
    console.log("   Database:", process.env.DB_NAME);
}

// Build connection config
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds connection timeout
};

// Add SSL for cloud databases (Railway, PlanetScale, etc.)
// Set DB_SSL=true in environment variables for cloud deployments
if (process.env.DB_SSL === 'true') {
    dbConfig.ssl = {
        rejectUnauthorized: false // Required for some cloud providers
    };
    if (NODE_ENV === 'development') {
        console.log("   SSL: enabled");
    }
}

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Convert pool to allow async/await
const promisePool = pool.promise();

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   Make sure your database server is running.');
        }
    } else {
        console.log('✅ Database connected successfully');
        connection.release();
    }
});

module.exports = promisePool;