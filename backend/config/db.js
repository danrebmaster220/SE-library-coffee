const mysql = require('mysql2');
require('dotenv').config();

console.log("Debugging Database Config:");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);
console.log("Pass:", process.env.DB_PASS);
console.log("Name:", process.env.DB_NAME);

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to allow async/await
const promisePool = pool.promise();

console.log("Database Pool Created...");

module.exports = promisePool;