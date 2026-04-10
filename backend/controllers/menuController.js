const db = require('../config/db');

// ── Menu card pricing (variant matrix + “From ₱min”) ───────────────────────

const norm = (s) => String(s || '').trim().toLowerCase();

/** Map global Temperature / Size options to stable slugs (first match wins). */
const pickOptionIdBySlug = (rows, kind) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (kind === 'iced') {
        const hit = rows.find((r) => {
            const n = norm(r.name);
            return n.includes('iced') || n.includes('ice') || n.includes('cold');
        });
        return hit ? hit.option_id : null;
    }
    if (kind === 'hot') {
        const hit = rows.find((r) => {
            const n = norm(r.name);
            return n === 'hot' || n.startsWith('hot ') || (n.includes('hot') && !n.includes('chocolate'));
        });
        return hit ? hit.option_id : null;
    }
    if (kind === 'medium') {
        const hit = rows.find((r) => norm(r.name).includes('medium') || norm(r.name).includes('med'));
        return hit ? hit.option_id : null;
    }
    if (kind === 'large') {
        const hit = rows.find((r) => norm(r.name).includes('large') || norm(r.name).includes('venti'));
        return hit ? hit.option_id : null;
    }
    return null;
};

let branchOptionCache = null;
const getBranchOptionIds = async () => {
    if (branchOptionCache) return branchOptionCache;

    const [tempRows] = await db.query(`
        SELECT co.option_id, co.name
        FROM customization_options co
        INNER JOIN customization_groups cg ON cg.group_id = co.group_id
        WHERE cg.status = 'active' AND co.status = 'available'
        AND LOWER(cg.name) LIKE '%temperature%'
        ORDER BY co.display_order ASC
    `);
    const [sizeRows] = await db.query(`
        SELECT co.option_id, co.name
        FROM customization_options co
        INNER JOIN customization_groups cg ON cg.group_id = co.group_id
        WHERE cg.status = 'active' AND co.status = 'available'
        AND LOWER(cg.name) LIKE '%size%'
        ORDER BY co.display_order ASC
    `);

    branchOptionCache = {
        iced: pickOptionIdBySlug(tempRows, 'iced'),
        hot: pickOptionIdBySlug(tempRows, 'hot'),
        medium: pickOptionIdBySlug(sizeRows, 'medium'),
        large: pickOptionIdBySlug(sizeRows, 'large'),
    };
    return branchOptionCache;
};

const nEq = (a, b) => {
    const x = a === undefined || a === null ? null : Number(a);
    const y = b === undefined || b === null ? null : Number(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return x === y;
    return x === y;
};

const matchVariantRow = (row, tempId, sizeId) => {
    const rt = row.temp_option_id != null ? Number(row.temp_option_id) : null;
    const rs = row.size_option_id != null ? Number(row.size_option_id) : null;
    const tt = tempId != null ? Number(tempId) : null;
    const ss = sizeId != null ? Number(sizeId) : null;
    return nEq(rt, tt) && nEq(rs, ss);
};

const computeMenuCardPricing = (item, variants, tempId, sizeId) => {
    const base = parseFloat(item.price || 0);
    const customizable = !!item.is_customizable;
    if (!customizable || !variants || variants.length === 0) {
        return {
            menu_price: base,
            menu_price_kind: 'base',
            menu_price_label: null,
        };
    }

    const prices = variants.map((v) => parseFloat(v.price)).filter((p) => !Number.isNaN(p));
    const minAll = prices.length ? Math.min(...prices) : base;
    const maxAll = prices.length ? Math.max(...prices) : base;

    const rowsForTemp = (tid) =>
        variants.filter((v) => nEq(v.temp_option_id, tid));

    // Full matrix: exact temp + size
    if (tempId != null && sizeId != null) {
        const hit = variants.find((v) => matchVariantRow(v, tempId, sizeId));
        if (hit) {
            return {
                menu_price: parseFloat(hit.price),
                menu_price_kind: 'exact',
                menu_price_label: null,
            };
        }
        return {
            menu_price: null,
            menu_price_kind: 'unavailable',
            menu_price_label: null,
        };
    }

    // Only temperature (e.g. Iced or Hot before size, or Hot single-column)
    if (tempId != null && sizeId == null) {
        const sub = rowsForTemp(tempId);
        if (sub.length === 0) {
            return {
                menu_price: null,
                menu_price_kind: 'unavailable',
                menu_price_label: null,
            };
        }
        const subPrices = sub.map((v) => parseFloat(v.price)).filter((p) => !Number.isNaN(p));
        const mn = Math.min(...subPrices);
        const mx = Math.max(...subPrices);
        if (sub.length === 1 || mn === mx) {
            return { menu_price: mn, menu_price_kind: 'exact', menu_price_label: null };
        }
        return {
            menu_price: mn,
            menu_price_kind: 'from',
            menu_price_label: `From ₱${mn.toFixed(0)}`,
        };
    }

    // No branch filters: lowest valid variant
    if (minAll === maxAll) {
        return { menu_price: minAll, menu_price_kind: 'exact', menu_price_label: null };
    }
    return {
        menu_price: minAll,
        menu_price_kind: 'from',
        menu_price_label: `From ₱${minAll.toFixed(0)}`,
    };
};

const toTinyBool = (value, fallback = 1) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value ? 1 : 0;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return 1;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return 0;
    return fallback;
};


// CATEGORIES

const MENU_CACHE_CONTROL = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';
/** Categories list must not be cached in the browser — admin edits (temp toggles, etc.) must show immediately after save. */
const CATEGORIES_LIST_CACHE_CONTROL = 'private, no-cache';

// Get All Categories
exports.getCategories = async (req, res) => {
    try {
        res.set('Cache-Control', CATEGORIES_LIST_CACHE_CONTROL);
        const [rows] = await db.query('SELECT * FROM categories ORDER BY category_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Category
exports.createCategory = async (req, res) => {
    const { name, icon, status, allow_hot, allow_iced, addon_limit } = req.body;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Ensure sequential IDs (Bypasses TiDB auto-increment caching jumps)
        const [maxResult] = await connection.query('SELECT COALESCE(MAX(category_id), 0) + 1 as nextId FROM categories FOR UPDATE');
        const nextId = maxResult[0].nextId;

        const parsedLimit = addon_limit != null && addon_limit !== '' ? parseInt(addon_limit, 10) : null;

        await connection.query(
            'INSERT INTO categories (category_id, name, status, allow_hot, allow_iced, addon_limit) VALUES (?, ?, ?, ?, ?, ?)',
            [
                nextId,
                name,
                status || 'active',
                toTinyBool(allow_hot, 1),
                toTinyBool(allow_iced, 1),
                Number.isNaN(parsedLimit) ? null : parsedLimit
            ]
        );
        
        await connection.commit();
        res.json({ 
            message: 'Category created successfully', 
            category_id: nextId 
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Update Category
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, icon, status, allow_hot, allow_iced, addon_limit } = req.body;

    try {
        const parsedLimit = addon_limit != null && addon_limit !== '' ? parseInt(addon_limit, 10) : null;

        await db.query(
            'UPDATE categories SET name = ?, status = ?, allow_hot = ?, allow_iced = ?, addon_limit = ? WHERE category_id = ?',
            [
                name,
                status,
                toTinyBool(allow_hot, 1),
                toTinyBool(allow_iced, 1),
                Number.isNaN(parsedLimit) ? null : parsedLimit,
                id
            ]
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
// Query: category_id, temp=(iced|hot), size=(medium|large) — enriches menu_price for kiosk/POS cards
exports.getItems = async (req, res) => {
    const { category_id, temp, size } = req.query;

    try {
        res.set('Cache-Control', MENU_CACHE_CONTROL);
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
        if (rows.length === 0) {
            return res.json([]);
        }

        const itemIds = rows.map((r) => r.item_id);
        const [variants] = await db.query(
            `SELECT item_id, size_option_id, temp_option_id, price 
             FROM item_variant_prices 
             WHERE item_id IN (?) AND status = 'active'`,
            [itemIds]
        );

        const byItem = {};
        for (const v of variants) {
            if (!byItem[v.item_id]) byItem[v.item_id] = [];
            byItem[v.item_id].push(v);
        }

        const branch = await getBranchOptionIds();
        let tempId = null;
        let sizeId = null;
        if (temp) {
            const t = String(temp).toLowerCase();
            if (t === 'iced') tempId = branch.iced;
            else if (t === 'hot') tempId = branch.hot;
        }
        if (size) {
            const s = String(size).toLowerCase();
            if (s === 'medium') sizeId = branch.medium;
            else if (s === 'large') sizeId = branch.large;
        }

        const enriched = rows.map((item) => {
            const vars = byItem[item.item_id] || [];
            const p = computeMenuCardPricing(item, vars, tempId, sizeId);
            return {
                ...item,
                menu_price: p.menu_price,
                menu_price_kind: p.menu_price_kind,
                menu_price_label: p.menu_price_label,
            };
        });

        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Item
exports.createItem = async (req, res) => {
    const { category_id, name, description, price, station, status, image, is_customizable } = req.body;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Ensure sequential IDs
        const [maxResult] = await connection.query('SELECT COALESCE(MAX(item_id), 0) + 1 as nextId FROM items FOR UPDATE');
        const nextId = maxResult[0].nextId;

        await connection.query(
            'INSERT INTO items (item_id, category_id, name, description, price, station, status, image, is_customizable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nextId, category_id, name, description || null, price, station, status || 'available', image || null, is_customizable || false]
        );
        
        await connection.commit();
        res.json({ 
            message: 'Item created successfully', 
            item_id: nextId 
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
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