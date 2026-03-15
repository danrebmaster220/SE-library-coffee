const db = require('../config/db');
const bcrypt = require('bcrypt');


// GET ALL USERS

exports.getUsers = async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT u.user_id, u.username, u.full_name, u.role_id, u.status, u.created_at, r.role_name
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
        `;

        const params = [];

        if (search) {
            query += ' WHERE u.username LIKE ? OR u.full_name LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY u.user_id ASC';

        const [users] = await db.query(query, params);
        res.json(users);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET USER BY ID

exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const [users] = await db.query(`
            SELECT u.user_id, u.username, u.full_name, u.role_id, u.status, u.created_at, r.role_name
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.user_id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CREATE USER

exports.createUser = async (req, res) => {
    const { full_name, username, password, role_id, status } = req.body;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if username exists
        const [existing] = await connection.query('SELECT user_id FROM users WHERE username = ?', [username]);
        
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Ensure sequential IDs (Bypasses TiDB auto-increment caching jumps)
        const [maxResult] = await connection.query('SELECT COALESCE(MAX(user_id), 0) + 1 as nextId FROM users FOR UPDATE');
        const nextId = maxResult[0].nextId;

        // Insert user
        await connection.query(
            'INSERT INTO users (user_id, role_id, full_name, username, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
            [nextId, role_id, full_name, username, password_hash, status || 'active']
        );

        await connection.commit();
        res.json({ 
            message: 'User created successfully', 
            user_id: nextId 
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};


// UPDATE USER

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { full_name, username, role_id, status } = req.body;

    try {
        // Check if username exists (exclude current user)
        const [existing] = await db.query('SELECT user_id FROM users WHERE username = ? AND user_id != ?', [username, id]);
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Update user
        await db.query(
            'UPDATE users SET full_name = ?, username = ?, role_id = ?, status = ? WHERE user_id = ?',
            [full_name, username, role_id, status, id]
        );

        res.json({ message: 'User updated successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// DELETE USER

exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        // Prevent deleting yourself (optional)
        if (req.user && req.user.user_id == id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await db.query('DELETE FROM users WHERE user_id = ?', [id]);
        res.json({ message: 'User deleted successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// RESET PASSWORD

exports.resetPassword = async (req, res) => {
    const { id } = req.params;
    const { new_password } = req.body;

    try {
        // Hash new password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(new_password, saltRounds);

        // Update password
        await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, id]);

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET ALL ROLES (for dropdown)

exports.getRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM roles ORDER BY role_id ASC');
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET CURRENT USER PROFILE

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const [users] = await db.query(`
            SELECT u.user_id, u.username, u.full_name, u.role_id, u.status, r.role_name
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.user_id = ?
        `, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// UPDATE CURRENT USER PROFILE

exports.updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { full_name } = req.body;

        if (!full_name || full_name.trim() === '') {
            return res.status(400).json({ error: 'Full name is required' });
        }

        await db.query('UPDATE users SET full_name = ? WHERE user_id = ?', [full_name.trim(), userId]);

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CHANGE CURRENT USER PASSWORD

exports.changeMyPassword = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // Verify current password
        const [users] = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(current_password, users[0].password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update new password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(new_password, saltRounds);

        await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, userId]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
