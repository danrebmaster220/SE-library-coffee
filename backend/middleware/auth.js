const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Normalize role payloads from both legacy and current JWT shapes.
const getRoleName = (user) => String(user?.role || user?.role_name || '').trim().toLowerCase();

const isAdminUser = (user) => {
    const roleId = Number(user?.role_id);
    if (!Number.isNaN(roleId) && roleId === 1) return true;
    return getRoleName(user) === 'admin';
};

const extractBearerToken = (rawValue) => {
    if (!rawValue) return null;
    const value = String(rawValue).trim();
    if (!value) return null;

    if (value.toLowerCase().startsWith('bearer ')) {
        return value.slice(7).trim() || null;
    }

    return value;
};

const verifySocketToken = (rawToken) => {
    const token = extractBearerToken(rawToken);
    if (!token) return null;

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (_error) {
        return null;
    }
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check if user is Admin
const isAdmin = (req, res, next) => {
    if (!isAdminUser(req.user)) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// Middleware to check if user is Admin or Cashier
const isAdminOrCashier = (req, res, next) => {
    const roleName = getRoleName(req.user);
    const roleId = Number(req.user?.role_id);
    const isCashier = roleName === 'cashier' || (!Number.isNaN(roleId) && roleId === 2);

    if (!isAdminUser(req.user) && !isCashier) {
        return res.status(403).json({ error: 'Access denied. Admin or Cashier only.' });
    }
    next();
};

// Require an active shift for all non-admin processing endpoints.
const requireActiveShiftForNonAdmin = async (req, res, next) => {
    try {
        if (isAdminUser(req.user)) {
            return next();
        }

        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Invalid user token payload.' });
        }

        const [activeShift] = await db.query(
            'SELECT shift_id FROM shifts WHERE user_id = ? AND status = ? LIMIT 1',
            [userId, 'active']
        );

        if (activeShift.length === 0) {
            return res.status(403).json({ error: 'No active shift. Start a new shift to continue processing.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    verifyToken,
    isAdmin,
    isAdminOrCashier,
    requireActiveShiftForNonAdmin,
    verifySocketToken,
    extractBearerToken
};
