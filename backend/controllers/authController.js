const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { resolveDisplayName } = require('../utils/userName');

// JWT Secret Key (In production, store this in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';


// LOGIN

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // First check if username exists (regardless of status)
        const [allUsers] = await db.query(
            `SELECT u.*, r.role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             WHERE u.username = ?`,
            [username]
        );

        if (allUsers.length === 0) {
            // Generic message for security - don't reveal if username exists
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = allUsers[0];

        // Check if account is inactive - this is okay to be specific
        // since it doesn't help with password guessing
        if (user.status !== 'active') {
            return res.status(401).json({ error: 'Account is inactive. Please contact admin.' });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            // Generic message for security - don't reveal that username was correct
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                username: user.username, 
                role: user.role_name 
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Return token and user info
        res.json({
            token,
            user: {
                id: user.user_id,
                username: user.username,
                fullName: resolveDisplayName(user),
                profileImage: user.profile_image || null,
                role: user.role_name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
};


// REGISTER (Admin creates new users)

exports.register = async (req, res) => {
    const { full_name, username, password, role_id } = req.body;

    try {
        // Check if username already exists
        const [existing] = await db.query('SELECT user_id FROM users WHERE username = ?', [username]);
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const [result] = await db.query(
            'INSERT INTO users (role_id, full_name, username, password_hash, status) VALUES (?, ?, ?, ?, ?)',
            [role_id, full_name, username, password_hash, 'active']
        );

        res.json({ 
            message: 'User created successfully', 
            user_id: result.insertId 
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
};


// VERIFY ADMIN CREDENTIALS (For void operations by cashiers)

exports.verifyAdmin = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find admin user by username
        const [users] = await db.query(
            `SELECT u.*, r.role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             WHERE u.username = ? AND u.status = 'active' AND r.role_name = 'admin'`,
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
        }

        const user = users[0];

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
        }

        // Return success with admin_id for void operations
        res.json({
            success: true,
            valid: true,
            admin_id: user.user_id,
            admin: {
                id: user.user_id,
                username: user.username,
                fullName: user.full_name
            }
        });

    } catch (error) {
        console.error('Admin verification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};


// VERIFY TOKEN (Check if user is logged in)

exports.verify = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Optionally fetch latest user info from DB
        const [users] = await db.query(
            `SELECT u.user_id, u.username, u.full_name, r.role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             WHERE u.user_id = ? AND u.status = 'active'`,
            [decoded.user_id]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        const user = users[0];

        res.json({
            valid: true,
            user: {
                id: user.user_id,
                username: user.username,
                fullName: resolveDisplayName(user),
                profileImage: user.profile_image || null,
                role: user.role_name
            }
        });

    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
