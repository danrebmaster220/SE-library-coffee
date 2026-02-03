const db = require('../config/db');


// CATEGORIES

// Get All Categories
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY category_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Category
exports.createCategory = async (req, res) => {
    const { name, icon, status } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO categories (name, status) VALUES (?, ?)',
            [name, status || 'active']
        );
        res.json({ 
            message: 'Category created successfully', 
            category_id: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Category
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, icon, status } = req.body;

    try {
        await db.query(
            'UPDATE categories SET name = ?, status = ? WHERE category_id = ?',
            [name, status, id]
        );
        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Category
exports.deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        // Check if category has items
        const [items] = await db.query('SELECT COUNT(*) as count FROM items WHERE category_id = ?', [id]);
        
        if (items[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete category with existing items' });
        }

        await db.query('DELETE FROM categories WHERE category_id = ?', [id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ITEMS

// Get All Items (optionally filter by category)
exports.getItems = async (req, res) => {
    const { category_id } = req.query;

    try {
        let query = `
            SELECT i.*, c.name as category_name 
            FROM items i 
            JOIN categories c ON i.category_id = c.category_id
        `;
        
        const params = [];
        
        if (category_id) {
            query += ' WHERE i.category_id = ?';
            params.push(category_id);
        }
        
        query += ' ORDER BY i.item_id ASC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Item
exports.createItem = async (req, res) => {
    const { category_id, name, description, price, station, status, image, is_customizable } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO items (category_id, name, description, price, station, status, image, is_customizable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [category_id, name, description || null, price, station, status || 'available', image || null, is_customizable || false]
        );
        res.json({ 
            message: 'Item created successfully', 
            item_id: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Item
exports.updateItem = async (req, res) => {
    const { id } = req.params;
    const { category_id, name, description, price, station, status, image, is_customizable } = req.body;

    try {
        await db.query(
            'UPDATE items SET category_id = ?, name = ?, description = ?, price = ?, station = ?, status = ?, image = ?, is_customizable = ? WHERE item_id = ?',
            [category_id, name, description, price, station, status, image, is_customizable || false, id]
        );
        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Item
exports.deleteItem = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM items WHERE item_id = ?', [id]);
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};