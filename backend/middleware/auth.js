const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

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
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// Middleware to check if user is Admin or Cashier
const isAdminOrCashier = (req, res, next) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Cashier') {
        return res.status(403).json({ error: 'Access denied. Admin or Cashier only.' });
    }
    next();
};

module.exports = { verifyToken, isAdmin, isAdminOrCashier };
