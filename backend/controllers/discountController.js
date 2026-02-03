const db = require('../config/db');

// Get All Discounts
exports.getDiscounts = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM discounts ORDER BY discount_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Active Discounts (for POS dropdown)
exports.getActiveDiscounts = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM discounts WHERE status = "active" ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Discount
exports.createDiscount = async (req, res) => {
    const { name, percentage, status } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO discounts (name, percentage, status) VALUES (?, ?, ?)',
            [name, percentage, status || 'active']
        );
        res.json({ 
            message: 'Discount created successfully', 
            discount_id: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Discount
exports.updateDiscount = async (req, res) => {
    const { id } = req.params;
    const { name, percentage, status } = req.body;

    try {
        await db.query(
            'UPDATE discounts SET name = ?, percentage = ?, status = ? WHERE discount_id = ?',
            [name, percentage, status, id]
        );
        res.json({ message: 'Discount updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Discount
exports.deleteDiscount = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM discounts WHERE discount_id = ?', [id]);
        res.json({ message: 'Discount deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
