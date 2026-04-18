const db = require('../config/db');
const {
    ALLOWED_DELAY_DAYS,
    getPriceUpdateSettings,
    updatePriceUpdateDelayDays,
    updateTaxSettings,
    scheduleBasePriceUpdate,
    getPendingPriceSchedules,
    cancelPendingPriceSchedule,
    replacePendingPriceSchedule,
    getPriceUpdateNotices
} = require('../services/priceScheduleService');
const { logAuditEvent } = require('../services/auditLogService');

const safeLogAuditEvent = async (payload) => {
    try {
        await logAuditEvent(payload);
    } catch (error) {
        console.error('⚠️ Audit log error:', error.message);
    }
};

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

const getActorUserIdFromRequest = (req) => {
    const raw = req?.user?.user_id ?? req?.user?.id ?? null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
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

// Get effective-date pricing settings (admin)
exports.getPriceUpdateSettings = async (_req, res) => {
    try {
        const settings = await getPriceUpdateSettings(db);
        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/** Public VAT display for kiosk footers (no auth). Cached briefly at CDN/browser. */
exports.getTaxDisplayPublic = async (_req, res) => {
    try {
        const settings = await getPriceUpdateSettings(db);
        res.set('Cache-Control', 'public, max-age=60');
        res.json({
            vat_enabled: Boolean(settings.vat_enabled),
            vat_rate_percent: Number(settings.vat_rate_percent) || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update effective-date pricing delay (admin)
exports.updatePriceUpdateSettings = async (req, res) => {
    try {
        const requestedDelay = Number(req.body?.delay_days);
        if (!ALLOWED_DELAY_DAYS.includes(requestedDelay)) {
            return res.status(400).json({
                error: `delay_days must be one of: ${ALLOWED_DELAY_DAYS.join(', ')}`
            });
        }

        const settings = await updatePriceUpdateDelayDays({
            delayDays: requestedDelay,
            actorUserId: getActorUserIdFromRequest(req),
            ipAddress: req.ip,
            queryRunner: db
        });

        res.json({
            message: 'Price update delay settings saved successfully',
            settings
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/** VAT toggle + rate (0–100). Send vat_enabled and/or vat_rate_percent. */
exports.updateTaxSettings = async (req, res) => {
    try {
        const body = req.body || {};
        const rawRate = body.vat_rate_percent;
        const hasRate =
            rawRate !== undefined &&
            rawRate !== null &&
            String(rawRate).trim() !== '';
        const hasEnabled = body.vat_enabled !== undefined && body.vat_enabled !== null;

        if (!hasRate && !hasEnabled) {
            return res.status(400).json({
                error: 'Provide vat_rate_percent and/or vat_enabled'
            });
        }

        const settings = await updateTaxSettings({
            vatRatePercent: hasRate ? rawRate : undefined,
            vatEnabled: hasEnabled ? body.vat_enabled : undefined,
            actorUserId: getActorUserIdFromRequest(req),
            ipAddress: req.ip,
            queryRunner: db
        });

        res.json({
            message: 'Tax settings saved successfully',
            settings
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// List pending scheduled price updates (admin)
exports.getPendingPriceSchedules = async (req, res) => {
    try {
        const itemId = req.query?.itemId != null ? Number(req.query.itemId) : null;
        const limit = req.query?.limit != null ? Number(req.query.limit) : 200;

        if (itemId != null && Number.isNaN(itemId)) {
            return res.status(400).json({ error: 'Invalid itemId value.' });
        }

        const schedules = await getPendingPriceSchedules({
            queryRunner: db,
            itemId,
            limit
        });

        res.json({
            count: schedules.length,
            schedules
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Cancel one pending price schedule (admin)
exports.cancelPendingPriceSchedule = async (req, res) => {
    const scheduleId = Number(req.params?.id);
    if (Number.isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule id.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const result = await cancelPendingPriceSchedule({
            connection,
            scheduleId,
            actorUserId: getActorUserIdFromRequest(req),
            reason: req.body?.reason || null
        });

        if (!result.cancelled) {
            await connection.rollback();
            return res.status(404).json({ error: 'Pending schedule not found.' });
        }

        await connection.commit();

        await safeLogAuditEvent({
            action: 'price_update_cancelled',
            actorUserId: getActorUserIdFromRequest(req),
            targetType: 'item_price_schedule',
            targetId: scheduleId,
            details: {
                schedule_id: scheduleId,
                item_id: Number(result.schedule?.item_id),
                price_scope: result.schedule?.price_scope,
                effective_at: result.schedule?.effective_at,
                cancelled_at: result.cancelled_at,
                reason: req.body?.reason || null
            },
            ipAddress: req.ip
        });

        res.json({
            message: 'Pending price schedule cancelled successfully.',
            result
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Replace one pending price schedule (admin)
exports.replacePendingPriceSchedule = async (req, res) => {
    const scheduleId = Number(req.params?.id);
    const newPrice = Number(req.body?.scheduled_price);

    if (Number.isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule id.' });
    }

    if (Number.isNaN(newPrice)) {
        return res.status(400).json({ error: 'Invalid scheduled_price value.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const result = await replacePendingPriceSchedule({
            connection,
            scheduleId,
            newPrice,
            actorUserId: getActorUserIdFromRequest(req),
            notes: req.body?.notes || 'Replaced from pending schedules manager'
        });

        if (!result.replaced) {
            await connection.rollback();
            if (result.reason === 'not_found_or_not_pending') {
                return res.status(404).json({ error: 'Pending schedule not found.' });
            }
            return res.status(400).json({
                error: result.reason === 'unchanged'
                    ? 'New price is unchanged from the currently effective price.'
                    : 'Unable to replace pending schedule.'
            });
        }

        await connection.commit();

        await safeLogAuditEvent({
            action: 'price_update_replaced',
            actorUserId: getActorUserIdFromRequest(req),
            targetType: 'item_price_schedule',
            targetId: Number(result.new_schedule_id),
            details: {
                old_schedule_id: Number(result.old_schedule_id),
                new_schedule_id: Number(result.new_schedule_id),
                item_id: Number(result.old_schedule?.item_id),
                price_scope: result.old_schedule?.price_scope,
                old_scheduled_price: Number(result.old_schedule?.scheduled_price),
                new_scheduled_price: Number(result.result?.scheduled_price),
                effective_at: result.effective_at,
                delay_days: result.delay_days,
                timezone: result.timezone
            },
            ipAddress: req.ip
        });

        res.json({
            message: 'Pending price schedule replaced successfully.',
            result
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Cashier/admin notice for upcoming effective price updates
exports.getPriceUpdateNotices = async (req, res) => {
    try {
        const windowHours = req.query?.windowHours != null ? Number(req.query.windowHours) : 24;
        const maxItems = req.query?.maxItems != null ? Number(req.query.maxItems) : 20;

        const payload = await getPriceUpdateNotices({
            queryRunner: db,
            windowHours,
            maxItems
        });

        res.json(payload);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Category
exports.createCategory = async (req, res) => {
    const { name, icon, status, allow_hot, allow_iced, addon_limit, requires_takeout_cup } = req.body;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Ensure sequential IDs (Bypasses TiDB auto-increment caching jumps)
        const [maxResult] = await connection.query('SELECT COALESCE(MAX(category_id), 0) + 1 as nextId FROM categories FOR UPDATE');
        const nextId = maxResult[0].nextId;

        const parsedLimit = addon_limit != null && addon_limit !== '' ? parseInt(addon_limit, 10) : null;

        await connection.query(
            'INSERT INTO categories (category_id, name, status, allow_hot, allow_iced, addon_limit, requires_takeout_cup) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                nextId,
                name,
                status || 'active',
                toTinyBool(allow_hot, 1),
                toTinyBool(allow_iced, 1),
                Number.isNaN(parsedLimit) ? null : parsedLimit,
                toTinyBool(requires_takeout_cup, 1)
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
    const { name, icon, status, allow_hot, allow_iced, addon_limit, requires_takeout_cup } = req.body;

    try {
        const parsedLimit = addon_limit != null && addon_limit !== '' ? parseInt(addon_limit, 10) : null;

        await db.query(
            'UPDATE categories SET name = ?, status = ?, allow_hot = ?, allow_iced = ?, addon_limit = ?, requires_takeout_cup = ? WHERE category_id = ?',
            [
                name,
                status,
                toTinyBool(allow_hot, 1),
                toTinyBool(allow_iced, 1),
                Number.isNaN(parsedLimit) ? null : parsedLimit,
                toTinyBool(requires_takeout_cup, 1),
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
            SELECT i.*, c.name as category_name, COALESCE(c.requires_takeout_cup, 1) as requires_takeout_cup
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

        const pendingByItem = new Map();
        try {
            const [pendingRows] = await db.query(
                `
                SELECT item_id, COUNT(*) AS pending_count, MIN(effective_at) AS next_effective_at
                FROM item_price_schedules
                WHERE status = 'pending'
                AND item_id IN (?)
                GROUP BY item_id
                `,
                [itemIds]
            );

            for (const row of pendingRows) {
                pendingByItem.set(Number(row.item_id), {
                    pending_count: Number(row.pending_count || 0),
                    next_effective_at: row.next_effective_at || null
                });
            }
        } catch (_error) {
            // If the schedule table is not available yet, skip metadata without failing the endpoint.
        }

        const enriched = rows.map((item) => {
            const vars = byItem[item.item_id] || [];
            const p = computeMenuCardPricing(item, vars, tempId, sizeId);
            const pending = pendingByItem.get(Number(item.item_id)) || null;
            return {
                ...item,
                menu_price: p.menu_price,
                menu_price_kind: p.menu_price_kind,
                menu_price_label: p.menu_price_label,
                has_pending_price_update: !!(pending && pending.pending_count > 0),
                pending_price_update_count: pending ? pending.pending_count : 0,
                next_price_effective_at: pending ? pending.next_effective_at : null
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
    const {
        category_id,
        name,
        description,
        price,
        station,
        status,
        image,
        is_customizable,
        apply_price_immediately
    } = req.body;

    const requestedPrice = Number(price);
    if (Number.isNaN(requestedPrice)) {
        return res.status(400).json({ error: 'Invalid price value.' });
    }

    const applyPriceImmediately =
        apply_price_immediately === true ||
        String(apply_price_immediately || '').toLowerCase() === 'true';

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [itemRows] = await connection.query(
            'SELECT item_id, price FROM items WHERE item_id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (itemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Item not found' });
        }

        const currentPrice = Number(itemRows[0].price || 0);
        const normalizedCurrent = Number(currentPrice.toFixed(2));
        const normalizedRequested = Number(requestedPrice.toFixed(2));
        const priceChanged = normalizedCurrent !== normalizedRequested;

        let persistedPrice = normalizedRequested;
        let priceUpdate = {
            mode: priceChanged ? 'immediate' : 'unchanged',
            current_price: normalizedCurrent,
            scheduled_price: priceChanged ? normalizedRequested : null,
            effective_at: null,
            delay_days: null,
            timezone: null
        };

        if (!applyPriceImmediately && priceChanged) {
            const scheduleResult = await scheduleBasePriceUpdate({
                connection,
                itemId: Number(id),
                newPrice: normalizedRequested,
                actorUserId: getActorUserIdFromRequest(req),
                notes: 'Scheduled from menu item update',
                settings: null
            });

            if (scheduleResult.scheduled) {
                persistedPrice = normalizedCurrent;
                priceUpdate = {
                    mode: 'scheduled',
                    current_price: scheduleResult.current_price,
                    scheduled_price: scheduleResult.scheduled_price,
                    effective_at: scheduleResult.effective_at,
                    delay_days: scheduleResult.delay_days,
                    timezone: scheduleResult.timezone,
                    schedule_id: scheduleResult.schedule_id,
                    replaced_count: Number(scheduleResult.replaced_count || 0)
                };
            } else {
                priceUpdate = {
                    mode: 'unchanged',
                    current_price: normalizedCurrent,
                    scheduled_price: null,
                    effective_at: null,
                    delay_days: null,
                    timezone: null
                };
            }
        }

        await connection.query(
            `
            UPDATE items
            SET category_id = ?,
                name = ?,
                description = ?,
                price = ?,
                station = ?,
                status = ?,
                image = ?,
                is_customizable = ?
            WHERE item_id = ?
            `,
            [
                category_id,
                name,
                description,
                persistedPrice,
                station,
                status,
                image,
                is_customizable || false,
                id
            ]
        );

        const [pendingCountRows] = await connection.query(
            `
            SELECT COUNT(*) AS pending_count
            FROM item_price_schedules
            WHERE item_id = ?
            AND status = 'pending'
            `,
            [id]
        );

        await connection.commit();

        if (priceUpdate.mode === 'scheduled') {
            await safeLogAuditEvent({
                action: 'price_update_scheduled',
                actorUserId: getActorUserIdFromRequest(req),
                targetType: 'item',
                targetId: Number(id),
                details: {
                    item_id: Number(id),
                    current_price: Number(priceUpdate.current_price),
                    scheduled_price: Number(priceUpdate.scheduled_price),
                    effective_at: priceUpdate.effective_at,
                    delay_days: Number(priceUpdate.delay_days),
                    timezone: priceUpdate.timezone,
                    replaced_count: Number(priceUpdate.replaced_count || 0),
                    schedule_id: priceUpdate.schedule_id != null ? Number(priceUpdate.schedule_id) : null
                },
                ipAddress: req.ip
            });
        }

        res.json({
            message: 'Item updated successfully',
            price_update: priceUpdate,
            pending_price_update_count: Number(pendingCountRows?.[0]?.pending_count || 0)
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
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