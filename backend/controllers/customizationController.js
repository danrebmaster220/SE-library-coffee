const db = require('../config/db');


// CUSTOMIZATION GROUPS

// Get all customization groups with their options
exports.getGroups = async (req, res) => {
    try {
        const [groups] = await db.query(`
            SELECT * FROM customization_groups 
            ORDER BY display_order ASC
        `);

        // Get options for each group
        for (let group of groups) {
            const [options] = await db.query(`
                SELECT * FROM customization_options 
                WHERE group_id = ? 
                ORDER BY display_order ASC
            `, [group.group_id]);
            group.options = options;
        }

        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get active customization groups with available options (for kiosk)
exports.getActiveGroups = async (req, res) => {
    try {
        const [groups] = await db.query(`
            SELECT * FROM customization_groups 
            WHERE status = 'active'
            ORDER BY display_order ASC
        `);

        // Get available options for each group
        for (let group of groups) {
            const [options] = await db.query(`
                SELECT * FROM customization_options 
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `, [group.group_id]);
            group.options = options;
        }

        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get customization groups for a specific item
exports.getItemCustomizations = async (req, res) => {
    const { itemId } = req.params;

    try {
        // First check if item is customizable
        const [items] = await db.query(
            'SELECT is_customizable FROM items WHERE item_id = ?',
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (!items[0].is_customizable) {
            return res.json({ groups: [], is_customizable: false });
        }

        // Get linked customization groups for this item
        const [groups] = await db.query(`
            SELECT cg.* FROM customization_groups cg
            INNER JOIN item_customization_groups icg ON cg.group_id = icg.group_id
            WHERE icg.item_id = ? AND cg.status = 'active'
            ORDER BY cg.display_order ASC
        `, [itemId]);

        // Get available options for each group
        for (let group of groups) {
            const [options] = await db.query(`
                SELECT * FROM customization_options 
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `, [group.group_id]);
            group.options = options;
        }

        res.json({ groups, is_customizable: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new customization group
exports.createGroup = async (req, res) => {
    const { name, display_order, selection_type, input_type, is_required, status, unit_label } = req.body;

    try {
        const [result] = await db.query(
            `INSERT INTO customization_groups 
            (name, display_order, selection_type, input_type, is_required, status, unit_label) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, display_order || 0, selection_type || 'single', input_type || 'choice', is_required || false, status || 'active', input_type === 'quantity' ? (unit_label || 'qty') : null]
        );

        res.json({ message: 'Group created successfully', group_id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a customization group
exports.updateGroup = async (req, res) => {
    const { id } = req.params;
    const { name, display_order, selection_type, input_type, is_required, status, unit_label } = req.body;

    try {
        await db.query(
            `UPDATE customization_groups 
            SET name = ?, display_order = ?, selection_type = ?, input_type = ?, is_required = ?, status = ?, unit_label = ?
            WHERE group_id = ?`,
            [name, display_order, selection_type, input_type, is_required, status, input_type === 'quantity' ? (unit_label || 'qty') : null, id]
        );

        res.json({ message: 'Group updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a customization group
exports.deleteGroup = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM customization_groups WHERE group_id = ?', [id]);
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CUSTOMIZATION OPTIONS

// Get options for a specific group
exports.getOptions = async (req, res) => {
    const { groupId } = req.params;

    try {
        const [options] = await db.query(
            'SELECT * FROM customization_options WHERE group_id = ? ORDER BY display_order ASC',
            [groupId]
        );
        res.json({ options });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new option
exports.createOption = async (req, res) => {
    const { group_id, name, price, price_per_unit, max_quantity, display_order, status } = req.body;

    try {
        const [result] = await db.query(
            `INSERT INTO customization_options 
            (group_id, name, price, price_per_unit, max_quantity, display_order, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [group_id, name, price || 0, price_per_unit || 0, max_quantity || 1, display_order || 0, status || 'available']
        );

        res.json({ message: 'Option created successfully', option_id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update an option
exports.updateOption = async (req, res) => {
    const { id } = req.params;
    const { name, price, price_per_unit, max_quantity, display_order, status } = req.body;

    try {
        await db.query(
            `UPDATE customization_options 
            SET name = ?, price = ?, price_per_unit = ?, max_quantity = ?, display_order = ?, status = ?
            WHERE option_id = ?`,
            [name, price, price_per_unit, max_quantity, display_order, status, id]
        );

        res.json({ message: 'Option updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete an option
exports.deleteOption = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM customization_options WHERE option_id = ?', [id]);
        res.json({ message: 'Option deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ITEM-CUSTOMIZATION LINKING

// Link customization groups to an item
exports.linkItemGroups = async (req, res) => {
    const { itemId } = req.params;
    const { group_ids } = req.body; // Array of group IDs

    try {
        // First, remove existing links
        await db.query('DELETE FROM item_customization_groups WHERE item_id = ?', [itemId]);

        // Then, add new links
        if (group_ids && group_ids.length > 0) {
            const values = group_ids.map(gid => [itemId, gid]);
            await db.query(
                'INSERT INTO item_customization_groups (item_id, group_id) VALUES ?',
                [values]
            );

            // Also mark the item as customizable
            await db.query(
                'UPDATE items SET is_customizable = TRUE WHERE item_id = ?',
                [itemId]
            );
        } else {
            // If no groups, mark as not customizable
            await db.query(
                'UPDATE items SET is_customizable = FALSE WHERE item_id = ?',
                [itemId]
            );
        }

        res.json({ message: 'Item customization groups updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get linked groups for an item
exports.getItemGroups = async (req, res) => {
    const { itemId } = req.params;

    try {
        const [groups] = await db.query(`
            SELECT cg.* FROM customization_groups cg
            INNER JOIN item_customization_groups icg ON cg.group_id = icg.group_id
            WHERE icg.item_id = ?
            ORDER BY cg.display_order ASC
        `, [itemId]);

        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// AUTO CUSTOMIZATION FOR BARISTA ITEMS

/**
 * Get barista defaults for an item - only returns Size/Temp if actually linked to the item
 * This respects the item's customization settings - admin must check Size/Temp for them to appear
 */
exports.getBaristaDefaults = async (req, res) => {
    const { itemId } = req.params;

    try {
        // Check if item exists and get its station
        const [items] = await db.query(
            `SELECT item_id, name, station, is_customizable FROM items WHERE item_id = ?`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = items[0];

        // If item is not customizable, no customization needed
        if (!item.is_customizable) {
            return res.json({ 
                needs_size_temp: false,
                size_group: null,
                temp_group: null,
                addon_groups: []
            });
        }

        // Get ALL customization groups linked to this item
        const [linkedGroups] = await db.query(`
            SELECT cg.* FROM customization_groups cg
            INNER JOIN item_customization_groups icg ON cg.group_id = icg.group_id
            WHERE icg.item_id = ? AND cg.status = 'active'
            ORDER BY cg.display_order ASC
        `, [itemId]);

        let size_group = null;
        let temp_group = null;
        let addon_groups = [];

        for (let group of linkedGroups) {
            // Fetch options for this group
            const [options] = await db.query(`
                SELECT * FROM customization_options 
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `, [group.group_id]);
            group.options = options;
            group.allow_multiple = group.selection_type === 'multiple';

            // Categorize the group
            if (group.name.toLowerCase().includes('size')) {
                size_group = group;
            } else if (group.name.toLowerCase().includes('temperature')) {
                temp_group = group;
            } else {
                addon_groups.push(group);
            }
        }

        res.json({
            needs_size_temp: !!(size_group || temp_group),
            size_group,
            temp_group,
            addon_groups
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
