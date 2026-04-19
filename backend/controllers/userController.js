const db = require('../config/db');
const bcrypt = require('bcrypt');
const { buildFullName, resolveDisplayName } = require('../utils/userName');
const { normalizeAdminPin, isValidAdminPinFormat } = require('../utils/adminPin');

const userSelectCols = `
    u.user_id, u.username, u.full_name, u.first_name, u.middle_name, u.last_name,
    u.profile_image, u.role_id, u.status, u.created_at, r.role_name
`;


// GET ALL USERS

exports.getUsers = async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT ${userSelectCols}
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
        `;

        const params = [];

        if (search) {
            query += ` WHERE u.username LIKE ? OR u.full_name LIKE ?
                OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ?`;
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        query += ' ORDER BY u.user_id ASC';

        const [users] = await db.query(query, params);
        res.json((users || []).map((u) => ({ ...u, display_name: resolveDisplayName(u) })));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET USER BY ID

exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const [users] = await db.query(`
            SELECT ${userSelectCols}
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.user_id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const row = users[0];
        res.json({ ...row, display_name: resolveDisplayName(row) });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CREATE USER

exports.createUser = async (req, res) => {
    const {
        first_name,
        middle_name,
        last_name,
        profile_image,
        username,
        password,
        role_id,
        status
    } = req.body;

    if (!first_name?.trim?.() || !last_name?.trim?.()) {
        return res.status(400).json({ error: 'First name and last name are required' });
    }
    const full_name = buildFullName(first_name, middle_name, last_name);

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

        const fn = String(first_name).trim();
        const mn = middle_name != null && String(middle_name).trim() ? String(middle_name).trim() : null;
        const ln = String(last_name).trim();
        const img = profile_image != null && String(profile_image).trim() ? String(profile_image).trim() : null;

        // Insert user
        await connection.query(
            `INSERT INTO users (user_id, role_id, full_name, first_name, middle_name, last_name, profile_image, username, password_hash, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nextId, role_id, full_name, fn, mn, ln, img, username, password_hash, status || 'active']
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
    const {
        first_name,
        middle_name,
        last_name,
        profile_image,
        username,
        role_id,
        status
    } = req.body;

    try {
        // Check if username exists (exclude current user)
        const [existing] = await db.query('SELECT user_id FROM users WHERE username = ? AND user_id != ?', [username, id]);
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        if (!first_name?.trim?.() || !last_name?.trim?.()) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }
        const full_name = buildFullName(first_name, middle_name, last_name);

        const fn = String(first_name).trim();
        const mn = middle_name != null && String(middle_name).trim() ? String(middle_name).trim() : null;
        const ln = String(last_name).trim();
        const img = profile_image !== undefined
            ? (profile_image != null && String(profile_image).trim() ? String(profile_image).trim() : null)
            : undefined;

        if (img !== undefined) {
            await db.query(
                `UPDATE users SET full_name = ?, first_name = ?, middle_name = ?, last_name = ?, profile_image = ?, username = ?, role_id = ?, status = ? WHERE user_id = ?`,
                [full_name, fn, mn, ln, img, username, role_id, status, id]
            );
        } else {
            await db.query(
                `UPDATE users SET full_name = ?, first_name = ?, middle_name = ?, last_name = ?, username = ?, role_id = ?, status = ? WHERE user_id = ?`,
                [full_name, fn, mn, ln, username, role_id, status, id]
            );
        }

        res.json({ message: 'User updated successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// DELETE USER — disabled: staff rows are referenced by transactions, shifts, and audit logs.
// Use status = inactive in PUT /users/:id instead.

exports.deleteUser = async (req, res) => {
    return res.status(403).json({
        error:
            'User accounts cannot be deleted. Set status to Inactive to revoke sign-in while keeping history for transactions and reports.'
    });
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
            SELECT ${userSelectCols}
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.user_id = ?
        `, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const row = users[0];
        res.json({
            ...row,
            display_name: resolveDisplayName(row)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// UPDATE CURRENT USER PROFILE

exports.updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const {
            first_name,
            middle_name,
            last_name,
            profile_image
        } = req.body;

        if (!first_name?.trim?.() || !last_name?.trim?.()) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }
        const full_name = buildFullName(first_name, middle_name, last_name);

        const fn = String(first_name).trim();
        const mn = middle_name != null && String(middle_name).trim() ? String(middle_name).trim() : null;
        const ln = String(last_name).trim();
        const img = profile_image !== undefined
            ? (profile_image != null && String(profile_image).trim() ? String(profile_image).trim() : null)
            : undefined;

        if (img !== undefined) {
            await db.query(
                `UPDATE users SET full_name = ?, first_name = ?, middle_name = ?, last_name = ?, profile_image = ? WHERE user_id = ?`,
                [full_name, fn, mn, ln, img, userId]
            );
        } else {
            await db.query(
                `UPDATE users SET full_name = ?, first_name = ?, middle_name = ?, last_name = ? WHERE user_id = ?`,
                [full_name, fn, mn, ln, userId]
            );
        }

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

        try {
            await db.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE user_id = ?', [password_hash, userId]);
        } catch (updateError) {
            // Backward compatibility for databases that do not yet have must_change_password.
            await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, userId]);
            if (updateError?.code !== 'ER_BAD_FIELD_ERROR') {
                throw updateError;
            }
        }

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CHANGE CURRENT ADMIN PIN

exports.changeMyPin = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const currentPin = normalizeAdminPin(req.body?.current_pin);
        const newPin = normalizeAdminPin(req.body?.new_pin);

        if (!isValidAdminPinFormat(newPin)) {
            return res.status(400).json({ error: 'New PIN must be exactly 6 digits.' });
        }

        const [users] = await db.query(
            `SELECT u.admin_pin_hash, r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const roleName = String(users[0].role_name || '').toLowerCase();
        if (roleName !== 'admin') {
            return res.status(403).json({ error: 'Only admin users can change authorization PIN.' });
        }

        const existingHash = users[0].admin_pin_hash;
        if (existingHash) {
            if (!isValidAdminPinFormat(currentPin)) {
                return res.status(400).json({ error: 'Current PIN is required and must be 6 digits.' });
            }

            const currentMatches = await bcrypt.compare(currentPin, existingHash);
            if (!currentMatches) {
                return res.status(401).json({ error: 'Current PIN is incorrect.' });
            }
        }

        const pinHash = await bcrypt.hash(newPin, 10);

        try {
            await db.query(
                'UPDATE users SET admin_pin_hash = ?, must_change_pin = 0 WHERE user_id = ?',
                [pinHash, userId]
            );
        } catch (updateError) {
            // Backward compatibility for databases that do not yet have must_change_pin.
            await db.query('UPDATE users SET admin_pin_hash = ? WHERE user_id = ?', [pinHash, userId]);
            if (updateError?.code !== 'ER_BAD_FIELD_ERROR') {
                throw updateError;
            }
        }

        res.json({ message: 'Authorization PIN updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
