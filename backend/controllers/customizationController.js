const db = require('../config/db');
const { scheduleVariantPriceUpdates } = require('../services/priceScheduleService');
const { logAuditEvent } = require('../services/auditLogService');

const safeLogAuditEvent = async (payload) => {
    try {
        await logAuditEvent(payload);
    } catch (error) {
        console.error('⚠️ Audit log error:', error.message);
    }
};

const isTemperatureGroup = (groupName) => String(groupName || '').trim().toLowerCase().includes('temperature');
const isSizeGroup = (groupName) => String(groupName || '').trim().toLowerCase().includes('size');
const isHotOption = (optionName) => String(optionName || '').trim().toLowerCase().includes('hot');
const isIcedOption = (optionName) => {
    const lowered = String(optionName || '').trim().toLowerCase();
    return lowered.includes('iced') || lowered.includes('cold');
};
const isLargeSizeOption = (optionName) => /large|22/i.test(String(optionName || '').trim());

const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const getItemTemperatureFlags = async (itemId) => {
    try {
        const [rows] = await db.query(`
            SELECT
                COALESCE(c.allow_hot, 1) AS allow_hot,
                COALESCE(c.allow_iced, 1) AS allow_iced
            FROM items i
            JOIN categories c ON i.category_id = c.category_id
            WHERE i.item_id = ?
            LIMIT 1
        `, [itemId]);

        if (rows.length === 0) {
            return { allow_hot: true, allow_iced: true };
        }

        return {
            allow_hot: !!rows[0].allow_hot,
            allow_iced: !!rows[0].allow_iced
        };
    } catch (error) {
        return { allow_hot: true, allow_iced: true };
    }
};

const applyTemperatureFilter = (group, flags) => {
    if (!isTemperatureGroup(group?.name)) return group;

    return {
        ...group,
        options: (group.options || []).filter((option) => {
            if (isHotOption(option.name) && !flags.allow_hot) return false;
            if (isIcedOption(option.name) && !flags.allow_iced) return false;
            return true;
        })
    };
};

/**
 * Combo rule: Hot can not be Large.
 * Keep this centralized so Admin/POS/Kiosk share one behavior.
 */
const isSizeTempComboAllowed = (sizeOptionName, tempOptionName) => {
    if (!tempOptionName || !sizeOptionName) return true;
    const hot = isHotOption(tempOptionName);
    const large = isLargeSizeOption(sizeOptionName);
    if (hot && large) return false;
    return true;
};

const getItemVariantPricing = async (itemId) => {
    try {
        await ensureVariantPricingTable(db);
        const [rows] = await db.query(`
            SELECT
                ivp.variant_id,
                ivp.item_id,
                ivp.size_option_id,
                ivp.temp_option_id,
                ivp.price,
                ivp.status,
                sopt.name AS size_option_name,
                topt.name AS temp_option_name
            FROM item_variant_prices ivp
            LEFT JOIN customization_options sopt ON sopt.option_id = ivp.size_option_id
            LEFT JOIN customization_options topt ON topt.option_id = ivp.temp_option_id
            WHERE ivp.item_id = ?
            AND ivp.status = 'active'
            ORDER BY ivp.variant_id ASC
        `, [itemId]);

        return rows;
    } catch (error) {
        return [];
    }
};

const nEqVariantId = (a, b) => {
    const x = a === undefined || a === null ? null : Number(a);
    const y = b === undefined || b === null ? null : Number(b);
    if (x === null && y === null) return true;
    if (x === null || y === null) return false;
    return x === y;
};

/**
 * M2: Required variant cells = size × temp combos after category temperature filter (matches kiosk/POS).
 */
const getVariantPricingCompletenessForItem = async (itemId) => {
    try {
        const [items] = await db.query(
            `SELECT is_customizable FROM items WHERE item_id = ? LIMIT 1`,
            [itemId]
        );
        if (!items.length || !items[0].is_customizable) {
            return {
                variant_pricing_complete: true,
                variant_pricing_missing_count: 0,
                variant_pricing_required_count: 0
            };
        }

        const flags = await getItemTemperatureFlags(itemId);
        const [linkedGroups] = await db.query(
            `
            SELECT cg.* FROM customization_groups cg
            INNER JOIN item_customization_groups icg ON cg.group_id = icg.group_id
            WHERE icg.item_id = ? AND cg.status = 'active'
            ORDER BY cg.display_order ASC
        `,
            [itemId]
        );

        let sizeOpts = [];
        let tempOpts = [];

        for (const group of linkedGroups) {
            const [options] = await db.query(
                `
                SELECT * FROM customization_options
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `,
                [group.group_id]
            );
            group.options = options;
            const prepared = applyTemperatureFilter(group, flags);
            const opts = prepared.options || [];

            if (isSizeGroup(prepared.name) && opts.length > 0) {
                sizeOpts = opts;
            } else if (isTemperatureGroup(prepared.name) && opts.length > 0) {
                tempOpts = opts;
            }
        }

        const combos = [];
        if (sizeOpts.length > 0 && tempOpts.length > 0) {
            tempOpts.forEach((t) => {
                sizeOpts.forEach((s) => {
                    if (!isSizeTempComboAllowed(s.name, t.name)) return;
                    combos.push({
                        size_option_id: s.option_id,
                        temp_option_id: t.option_id
                    });
                });
            });
        } else if (sizeOpts.length > 0) {
            sizeOpts.forEach((s) =>
                combos.push({ size_option_id: s.option_id, temp_option_id: null })
            );
        } else if (tempOpts.length > 0) {
            tempOpts.forEach((t) =>
                combos.push({ size_option_id: null, temp_option_id: t.option_id })
            );
        }

        if (combos.length === 0) {
            return {
                variant_pricing_complete: true,
                variant_pricing_missing_count: 0,
                variant_pricing_required_count: 0
            };
        }

        const rows = await getItemVariantPricing(itemId);
        const rowMatchesCombo = (sizeId, tempId) =>
            rows.find(
                (r) =>
                    nEqVariantId(r.size_option_id, sizeId) &&
                    nEqVariantId(r.temp_option_id, tempId)
            );

        let missing = 0;
        for (const c of combos) {
            const hit = rowMatchesCombo(c.size_option_id, c.temp_option_id);
            if (!hit) {
                missing += 1;
                continue;
            }
            const p = parseFloat(hit.price);
            if (Number.isNaN(p)) {
                missing += 1;
            }
        }

        return {
            variant_pricing_complete: missing === 0,
            variant_pricing_missing_count: missing,
            variant_pricing_required_count: combos.length
        };
    } catch (e) {
        return {
            variant_pricing_complete: true,
            variant_pricing_missing_count: 0,
            variant_pricing_required_count: 0
        };
    }
};

const ensureVariantPricingTable = async (queryRunner) => {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS item_variant_prices (
            variant_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            item_id INT NOT NULL,
            size_option_id INT NULL,
            temp_option_id INT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_item_variant_combo (item_id, size_option_id, temp_option_id),
            INDEX idx_item_variant_item (item_id),
            INDEX idx_item_variant_size (size_option_id),
            INDEX idx_item_variant_temp (temp_option_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
};

const mapVariantPricingError = (error) => {
    const code = error?.code || '';
    if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR' || code === 'ER_TABLEACCESS_DENIED_ERROR') {
        return 'Database permission denied while saving variant prices. Check DB credentials/privileges.';
    }
    if (code === 'ER_NO_SUCH_TABLE') {
        return 'Variant pricing table is missing. Restart backend to run migrations, then try again.';
    }
    return error?.message || 'Failed to save variant prices.';
};


// CUSTOMIZATION GROUPS

// Get all customization groups with their options
exports.getGroups = async (req, res) => {
    try {
        const [groups] = await db.query(`
            SELECT * FROM customization_groups 
            ORDER BY display_order ASC
        `);

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
        const temperatureFlags = await getItemTemperatureFlags(itemId);

        const [items] = await db.query(
            `SELECT i.item_id, i.is_customizable, i.price, i.category_id, c.addon_limit
             FROM items i
             LEFT JOIN categories c ON i.category_id = c.category_id
             WHERE i.item_id = ?`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = items[0];

        if (!item.is_customizable) {
            return res.json({
                groups: [],
                is_customizable: false,
                base_price: Number(item.price || 0),
                variant_pricing: [],
                temperature_flags: temperatureFlags,
                addon_limit: item.addon_limit != null ? Number(item.addon_limit) : null
            });
        }

        const [groups] = await db.query(`
            SELECT cg.* FROM customization_groups cg
            INNER JOIN item_customization_groups icg ON cg.group_id = icg.group_id
            WHERE icg.item_id = ? AND cg.status = 'active'
            ORDER BY cg.display_order ASC
        `, [itemId]);

        for (let group of groups) {
            const [options] = await db.query(`
                SELECT * FROM customization_options 
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `, [group.group_id]);
            group.options = options;
        }

        const filteredGroups = groups.map((group) => applyTemperatureFilter(group, temperatureFlags));
        const variantPricing = await getItemVariantPricing(itemId);

        res.json({
            groups: filteredGroups,
            is_customizable: true,
            base_price: Number(item.price || 0),
            variant_pricing: variantPricing,
            temperature_flags: temperatureFlags,
            addon_limit: item.addon_limit != null ? Number(item.addon_limit) : null
        });
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
    const { group_ids } = req.body;

    try {
        await db.query('DELETE FROM item_customization_groups WHERE item_id = ?', [itemId]);

        if (group_ids && group_ids.length > 0) {
            const values = group_ids.map((gid) => [itemId, gid]);
            await db.query(
                'INSERT INTO item_customization_groups (item_id, group_id) VALUES ?',
                [values]
            );

            await db.query(
                'UPDATE items SET is_customizable = TRUE WHERE item_id = ?',
                [itemId]
            );
        } else {
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

// Get variant pricing rows for an item (admin)
exports.getItemVariantPrices = async (req, res) => {
    const { itemId } = req.params;

    try {
        const variants = await getItemVariantPricing(itemId);
        res.json({ variants });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Replace variant pricing rows for an item (admin)
exports.saveItemVariantPrices = async (req, res) => {
    const { itemId } = req.params;
    const { variants, apply_price_immediately } = req.body;
    const connection = await db.getConnection();
    const applyPriceImmediately =
        apply_price_immediately === true ||
        String(apply_price_immediately || '').toLowerCase() === 'true';
    const actorUserIdRaw = req?.user?.user_id ?? req?.user?.id ?? null;
    const actorUserId = Number.isNaN(Number(actorUserIdRaw)) ? null : Number(actorUserIdRaw);

    try {
        await connection.beginTransaction();

        await ensureVariantPricingTable(connection);

        let variantList = Array.isArray(variants) ? variants : [];
        const flags = await getItemTemperatureFlags(itemId);
        const tempIds = [
            ...new Set(
                variantList
                    .map((r) => toNumberOrNull(r.temp_option_id))
                    .filter((id) => id != null)
            )
        ];
        const sizeIds = [
            ...new Set(
                variantList
                    .map((r) => toNumberOrNull(r.size_option_id))
                    .filter((id) => id != null)
            )
        ];
        let tempNameById = new Map();
        let sizeNameById = new Map();
        if (tempIds.length > 0) {
            const [tops] = await connection.query(
                `SELECT option_id, name FROM customization_options WHERE option_id IN (?)`,
                [tempIds]
            );
            tempNameById = new Map(tops.map((o) => [o.option_id, o.name]));
        }
        if (sizeIds.length > 0) {
            const [sops] = await connection.query(
                `SELECT option_id, name FROM customization_options WHERE option_id IN (?)`,
                [sizeIds]
            );
            sizeNameById = new Map(sops.map((o) => [o.option_id, o.name]));
        }

        variantList = variantList.filter((row) => {
            const tid = toNumberOrNull(row.temp_option_id);
            const sid = toNumberOrNull(row.size_option_id);
            if (tid == null) return true;
            const name = tempNameById.get(tid);
            if (name === undefined) return false;
            if (isHotOption(name) && !flags.allow_hot) return false;
            if (isIcedOption(name) && !flags.allow_iced) return false;
            const sizeName = sid == null ? null : sizeNameById.get(sid);
            if (!isSizeTempComboAllowed(sizeName, name)) return false;
            return true;
        });

        const dedupe = new Set();
        const values = [];

        for (const row of variantList) {
            const sizeOptionId = toNumberOrNull(row.size_option_id);
            const tempOptionId = toNumberOrNull(row.temp_option_id);
            const price = Number(row.price);
            const status = String(row.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

            if ((sizeOptionId === null && tempOptionId === null) || Number.isNaN(price)) {
                continue;
            }

            const key = `${sizeOptionId ?? 'null'}:${tempOptionId ?? 'null'}`;
            if (dedupe.has(key)) continue;
            dedupe.add(key);

            values.push([
                Number(itemId),
                sizeOptionId,
                tempOptionId,
                Number(price.toFixed(2)),
                status
            ]);
        }

        const normalizedVariants = values.map((row) => ({
            size_option_id: row[1],
            temp_option_id: row[2],
            price: row[3],
            status: row[4]
        }));

        let priceUpdate = {
            mode: 'scheduled',
            scheduled_count: 0,
            replaced_count: 0,
            unchanged_count: normalizedVariants.length,
            effective_at: null,
            delay_days: null,
            timezone: null
        };

        if (applyPriceImmediately) {
            await connection.query('DELETE FROM item_variant_prices WHERE item_id = ?', [itemId]);

            if (values.length > 0) {
                await connection.query(
                    `INSERT INTO item_variant_prices (item_id, size_option_id, temp_option_id, price, status)
                     VALUES ?`,
                    [values]
                );
            }

            priceUpdate = {
                mode: 'immediate',
                scheduled_count: 0,
                replaced_count: 0,
                unchanged_count: 0,
                effective_at: null,
                delay_days: null,
                timezone: null
            };
        } else {
            const scheduleResult = await scheduleVariantPriceUpdates({
                connection,
                itemId: Number(itemId),
                variantRows: normalizedVariants,
                actorUserId,
                notes: 'Scheduled from item variant matrix update',
                settings: null
            });

            priceUpdate = {
                mode: scheduleResult.scheduled_count > 0 ? 'scheduled' : 'unchanged',
                scheduled_count: scheduleResult.scheduled_count,
                replaced_count: scheduleResult.replaced_count,
                unchanged_count: scheduleResult.unchanged_count,
                effective_at: scheduleResult.effective_at,
                delay_days: scheduleResult.delay_days,
                timezone: scheduleResult.timezone,
                schedule_ids: scheduleResult.schedule_ids || []
            };
        }

        await connection.commit();

        if (!applyPriceImmediately && Number(priceUpdate.scheduled_count || 0) > 0) {
            await safeLogAuditEvent({
                action: 'price_update_scheduled',
                actorUserId,
                targetType: 'item',
                targetId: Number(itemId),
                details: {
                    item_id: Number(itemId),
                    scope: 'variant',
                    scheduled_count: Number(priceUpdate.scheduled_count),
                    replaced_count: Number(priceUpdate.replaced_count || 0),
                    unchanged_count: Number(priceUpdate.unchanged_count || 0),
                    effective_at: priceUpdate.effective_at,
                    delay_days: Number(priceUpdate.delay_days || 0),
                    timezone: priceUpdate.timezone,
                    schedule_ids: Array.isArray(priceUpdate.schedule_ids) ? priceUpdate.schedule_ids : []
                },
                ipAddress: req.ip
            });
        }

        const completeness = await getVariantPricingCompletenessForItem(itemId);
        res.json({
            message: applyPriceImmediately ? 'Variant prices saved successfully' : 'Variant price update scheduled successfully',
            count: values.length,
            price_update: priceUpdate,
            ...completeness
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({
            error: mapVariantPricingError(error),
            code: error?.code || 'UNKNOWN'
        });
    } finally {
        connection.release();
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
        const temperatureFlags = await getItemTemperatureFlags(itemId);

        const [items] = await db.query(
            `SELECT i.item_id, i.name, i.station, i.is_customizable, i.price, c.addon_limit
             FROM items i
             LEFT JOIN categories c ON i.category_id = c.category_id
             WHERE i.item_id = ?`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = items[0];

        if (!item.is_customizable) {
            return res.json({
                needs_size_temp: false,
                size_group: null,
                temp_group: null,
                addon_groups: [],
                base_price: Number(item.price || 0),
                variant_pricing: [],
                temperature_flags: temperatureFlags,
                addon_limit: item.addon_limit != null ? Number(item.addon_limit) : null
            });
        }

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
            const [options] = await db.query(`
                SELECT * FROM customization_options
                WHERE group_id = ? AND status = 'available'
                ORDER BY display_order ASC
            `, [group.group_id]);

            group.options = options;
            const preparedGroup = applyTemperatureFilter(group, temperatureFlags);
            const preparedOptions = preparedGroup.options || [];

            if ((isSizeGroup(preparedGroup.name) || isTemperatureGroup(preparedGroup.name)) && preparedOptions.length === 0) {
                continue;
            }

            preparedGroup.allow_multiple = preparedGroup.selection_type === 'multiple';

            if (isSizeGroup(preparedGroup.name)) {
                size_group = preparedGroup;
            } else if (isTemperatureGroup(preparedGroup.name)) {
                temp_group = preparedGroup;
            } else {
                addon_groups.push(preparedGroup);
            }
        }

        const variantPricing = await getItemVariantPricing(itemId);

        res.json({
            needs_size_temp: !!(size_group || temp_group),
            size_group,
            temp_group,
            addon_groups,
            base_price: Number(item.price || 0),
            variant_pricing: variantPricing,
            temperature_flags: temperatureFlags,
            addon_limit: item.addon_limit != null ? Number(item.addon_limit) : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
