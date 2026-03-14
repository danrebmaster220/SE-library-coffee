/**
 * One-time import script for Filess.io
 * Run this on Render after deploying with new env vars
 * This runs FROM Render's IP which is whitelisted by Filess.io
 * 
 * Usage: node config/import-filess.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function importDatabase() {
    console.log('🔌 Connecting to Filess.io database...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '8a8yaw.h.filess.io',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER || 'coffee_db_boutwenty',
        password: process.env.DB_PASS || '42489ac546c481524f0493e624f77626bf5102aa',
        database: process.env.DB_NAME || 'coffee_db_boutwenty',
        ssl: { rejectUnauthorized: false },
        multipleStatements: true,
    });

    console.log('✅ Connected!');

    const sqlFile = path.join(__dirname, 'coffee_database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📥 Importing database schema and data...');

    try {
        await connection.query(sql);
        console.log('✅ Database imported successfully!');
    } catch (err) {
        console.error('❌ Import error:', err.message);
    }

    await connection.end();
    console.log('🎉 Done!');
}

importDatabase().catch(console.error);
