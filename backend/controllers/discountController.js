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
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Ensure sequential IDs (Bypasses TiDB auto-increment caching jumps)
        const [maxResult] = await connection.query('SELECT COALESCE(MAX(discount_id), 0) + 1 as nextId FROM discounts FOR UPDATE');
        const nextId = maxResult[0].nextId;

        await connection.query(
            'INSERT INTO discounts (discount_id, name, percentage, status) VALUES (?, ?, ?, ?)',
            [nextId, name, percentage, status || 'active']
        );
        
        await connection.commit();
        res.json({ 
            message: 'Discount created successfully', 
            discount_id: nextId 
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
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
