const mysql = require('mysql2');
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Log database config to debug connection issues
console.log("📦 Database Configuration:");
console.log("   Host:", process.env.DB_HOST);
console.log("   Port:", process.env.DB_PORT || 3306);
console.log("   User:", process.env.DB_USER);
console.log("   Database:", process.env.DB_NAME);
console.log("   Password:", process.env.DB_PASS ? '***SET***' : 'MISSING');
console.log("   SSL:", process.env.DB_SSL);

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
    connectTimeout: 30000,       // 30 seconds connection timeout
    enableKeepAlive: true,       // Keep connections alive
    keepAliveInitialDelay: 10000, // Start keep-alive after 10s
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

// Keep-alive ping every 5 minutes to prevent Railway from dropping idle connections
setInterval(() => {
    pool.query('SELECT 1', (err) => {
        if (err) {
            console.error('⚠️  Keep-alive ping failed:', err.message);
        }
    });
}, 5 * 60 * 1000);

module.exports = promisePool;