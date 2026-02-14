const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'coffee.db');

if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found. Run node config/init-db.js first.');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);
const hash = bcrypt.hashSync('password123', 10);

db.serialize(() => {
    db.run('DELETE FROM users WHERE username IN (?, ?, ?)', ['admin', 'cashier', 'barista']);
    db.run('INSERT INTO users (role_id, full_name, username, password_hash, status) VALUES (?, ?, ?, ?, ?)',
        [1, 'Admin', 'admin', hash, 'active']);
    db.run('INSERT INTO users (role_id, full_name, username, password_hash, status) VALUES (?, ?, ?, ?, ?)',
        [2, 'Cashier', 'cashier', hash, 'active']);
});

db.close(() => {
    console.log('Done! Login: admin/password123, cashier/password123');
});
