const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    console.log('🔐 Generating password hashes...');

    // Hash the default password
    const password = 'password123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    console.log('✅ Password hashed successfully');

    // Delete existing users (optional)
    await connection.query('DELETE FROM users WHERE username IN ("admin", "cashier", "barista")');
    console.log('🗑️  Cleared existing demo users');

    // Insert users with proper hashed passwords
    const users = [
        { role_id: 1, full_name: 'Admin', username: 'admin', password_hash: hash },
        { role_id: 2, full_name: 'Cashier', username: 'cashier', password_hash: hash },
    ];

    for (const user of users) {
        await connection.query(
            'INSERT INTO users (role_id, full_name, username, password_hash, status) VALUES (?, ?, ?, ?, ?)',
            [user.role_id, user.full_name, user.username, user.password_hash, 'active']
        );
        console.log(`✅ Created user: ${user.username}`);
    }

    console.log('\n🎉 User seeding complete!');
    console.log('📝 Login credentials for all users:');
    console.log('   Username: admin     | Password: password123 | Role: Admin');
    console.log('   Username: cashier   | Password: password123 | Role: Cashier');

    await connection.end();
}

seedUsers().catch(console.error);
