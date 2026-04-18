const db = require('../config/db');
const { logAuditEvent } = require('./auditLogService');

const DEFAULT_DELAY_DAYS = 3;
const DEFAULT_TIMEZONE = 'Asia/Manila';
const ALLOWED_DELAY_DAYS = [3, 5, 7];
const DEFAULT_DELAY_OPTIONS = [3, 5, 7];

const SETTING_KEYS = {
    DELAY_DAYS: 'price_update_delay_days',
    TIMEZONE: 'price_update_timezone',
    DELAY_OPTIONS: 'price_update_delay_options',
    VAT_RATE_PERCENT: 'vat_rate_percent',
    VAT_ENABLED: 'vat_enabled'
};

const DEFAULT_VAT_RATE_PERCENT = 12;

const PRICE_SCOPE = {
    BASE: 'base',
    VARIANT: 'variant'
};

const safeLogAuditEvent = async (payload) => {
    try {
        await logAuditEvent(payload);
    } catch (error) {
        console.error('⚠️ Audit log error:', error.message);
    }
};

const pad2 = (value) => String(value).padStart(2, '0');

const numberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const normalizePrice = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return null;
    return Number(parsed.toFixed(2));
};

const normalizeDelayDays = (value, allowed = ALLOWED_DELAY_DAYS, fallback = DEFAULT_DELAY_DAYS) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    const intValue = Math.round(parsed);
    return allowed.includes(intValue) ? intValue : fallback;
};

/** VAT rate stored as percent (e.g. 12 = 12%). Clamped 0–100, max 2 decimal places. */
const normalizeVatRatePercent = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return DEFAULT_VAT_RATE_PERCENT;
    const clamped = Math.min(100, Math.max(0, parsed));
    return Math.round(clamped * 100) / 100;
};

/** Stored as "0" / "1" in system_settings. Default off until admin enables. */
const normalizeVatEnabled = (value) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const s = String(value ?? '').trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'off' || s === '') return false;
    return false;
};

const parseDelayOptions = (rawValue) => {
    if (!rawValue) return [...DEFAULT_DELAY_OPTIONS];
    const parsed = String(rawValue)
        .split(',')
        .map((token) => Number(token.trim()))
        .filter((n) => Number.isInteger(n));

    const filtered = [...new Set(parsed)].filter((n) => ALLOWED_DELAY_DAYS.includes(n));
    return filtered.length > 0 ? filtered : [...DEFAULT_DELAY_OPTIONS];
};

const getDatePartsInTimezone = (date, timezone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second)
    };
};

const toPseudoUtcDate = (parts) =>
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));

const formatPseudoUtcAsMysqlDateTime = (pseudoUtcDate) =>
    `${pseudoUtcDate.getUTCFullYear()}-${pad2(pseudoUtcDate.getUTCMonth() + 1)}-${pad2(pseudoUtcDate.getUTCDate())} ${pad2(pseudoUtcDate.getUTCHours())}:${pad2(pseudoUtcDate.getUTCMinutes())}:${pad2(pseudoUtcDate.getUTCSeconds())}`;

const nowInTimezoneMysql = (timezone = DEFAULT_TIMEZONE) => {
    try {
        const parts = getDatePartsInTimezone(new Date(), timezone);
        const pseudoUtcDate = toPseudoUtcDate(parts);
        return formatPseudoUtcAsMysqlDateTime(pseudoUtcDate);
    } catch (_error) {
        const now = new Date();
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    }
};

const effectiveAtFromDelayDays = ({ delayDays, timezone = DEFAULT_TIMEZONE }) => {
    const safeDelay = normalizeDelayDays(delayDays);
    const parts = getDatePartsInTimezone(new Date(), timezone);
    const pseudoUtcDate = toPseudoUtcDate(parts);
    pseudoUtcDate.setUTCDate(pseudoUtcDate.getUTCDate() + safeDelay);
    return formatPseudoUtcAsMysqlDateTime(pseudoUtcDate);
};

const addHoursToTimezoneMysqlDateTime = ({
    sourceDateTime,
    timezone = DEFAULT_TIMEZONE,
    hours = 24
}) => {
    const fallbackNow = nowInTimezoneMysql(timezone);
    const safeSource = sourceDateTime || fallbackNow;

    const [datePart, timePart = '00:00:00'] = String(safeSource).split(' ');
    const [year, month, day] = String(datePart || '').split('-').map((n) => Number(n));
    const [hour, minute, second] = String(timePart || '').split(':').map((n) => Number(n));

    if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) {
        return fallbackNow;
    }

    const pseudoUtcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    pseudoUtcDate.setUTCHours(pseudoUtcDate.getUTCHours() + Number(hours || 0));
    return formatPseudoUtcAsMysqlDateTime(pseudoUtcDate);
};

const ensureSystemSettingsTable = async (queryRunner = db) => {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(50) NOT NULL,
            setting_value TEXT DEFAULT NULL,
            PRIMARY KEY (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
};

const ensurePriceSchedulesTable = async (queryRunner = db) => {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS item_price_schedules (
            schedule_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            item_id INT NOT NULL,
            price_scope ENUM('base','variant') NOT NULL DEFAULT 'base',
            size_option_id INT NULL,
            temp_option_id INT NULL,
            current_price DECIMAL(10,2) NULL,
            scheduled_price DECIMAL(10,2) NOT NULL,
            status ENUM('pending','applied','cancelled','replaced','failed') NOT NULL DEFAULT 'pending',
            effective_at DATETIME NOT NULL,
            applied_at DATETIME NULL,
            cancelled_at DATETIME NULL,
            replaced_by_schedule_id BIGINT NULL,
            timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
            notes VARCHAR(255) NULL,
            created_by INT NULL,
            updated_by INT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_price_sched_status_effective (status, effective_at),
            INDEX idx_price_sched_item_scope_status (item_id, price_scope, status, effective_at),
            INDEX idx_price_sched_variant_opts (size_option_id, temp_option_id),
            INDEX idx_price_sched_created_by (created_by),
            INDEX idx_price_sched_updated_by (updated_by),
            INDEX idx_price_sched_replaced_by (replaced_by_schedule_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
};

const getPriceUpdateSettings = async (queryRunner = db) => {
    await ensureSystemSettingsTable(queryRunner);

    const [rows] = await queryRunner.query(
        `
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN (?, ?, ?)
        `,
        [
            SETTING_KEYS.DELAY_DAYS,
            SETTING_KEYS.TIMEZONE,
            SETTING_KEYS.DELAY_OPTIONS
        ]
    );

    const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));

    const delayOptions = parseDelayOptions(map.get(SETTING_KEYS.DELAY_OPTIONS));
    const delayDays = normalizeDelayDays(
        map.get(SETTING_KEYS.DELAY_DAYS),
        delayOptions,
        DEFAULT_DELAY_DAYS
    );

    const timezone = String(map.get(SETTING_KEYS.TIMEZONE) || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

    const [vatRows] = await queryRunner.query(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?)`,
        [SETTING_KEYS.VAT_RATE_PERCENT, SETTING_KEYS.VAT_ENABLED]
    );
    const vatMap = new Map(vatRows.map((r) => [r.setting_key, r.setting_value]));
    const vat_rate_percent = normalizeVatRatePercent(vatMap.get(SETTING_KEYS.VAT_RATE_PERCENT));
    const vat_enabled = normalizeVatEnabled(vatMap.get(SETTING_KEYS.VAT_ENABLED));

    return {
        delay_days: delayDays,
        timezone,
        delay_options: delayOptions,
        vat_rate_percent,
        vat_enabled
    };
};

const updatePriceUpdateDelayDays = async ({
    delayDays,
    actorUserId = null,
    ipAddress = null,
    queryRunner = db
}) => {
    await ensureSystemSettingsTable(queryRunner);

    const effectiveDelay = normalizeDelayDays(delayDays, ALLOWED_DELAY_DAYS, DEFAULT_DELAY_DAYS);

    await queryRunner.query(
        `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        [SETTING_KEYS.DELAY_DAYS, String(effectiveDelay)]
    );

    await queryRunner.query(
        `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        [SETTING_KEYS.DELAY_OPTIONS, DEFAULT_DELAY_OPTIONS.join(',')]
    );

    await queryRunner.query(
        `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        [SETTING_KEYS.TIMEZONE, DEFAULT_TIMEZONE]
    );

    await safeLogAuditEvent({
        action: 'price_update_delay_changed',
        actorUserId,
        targetType: 'system_settings',
        targetId: null,
        details: {
            setting_key: SETTING_KEYS.DELAY_DAYS,
            delay_days: effectiveDelay
        },
        ipAddress
    });

    return getPriceUpdateSettings(queryRunner);
};

const updateTaxSettings = async ({
    vatRatePercent = undefined,
    vatEnabled = undefined,
    actorUserId = null,
    ipAddress = null,
    queryRunner = db
}) => {
    await ensureSystemSettingsTable(queryRunner);

    const updateRate = vatRatePercent !== undefined && vatRatePercent !== null && String(vatRatePercent).trim() !== '';
    const updateEnabled = vatEnabled !== undefined && vatEnabled !== null;

    if (!updateRate && !updateEnabled) {
        throw new Error('Provide vat_rate_percent and/or vat_enabled');
    }

    let nextRate = null;
    let nextEnabled = null;

    if (updateRate) {
        nextRate = normalizeVatRatePercent(vatRatePercent);
        await queryRunner.query(
            `
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            `,
            [SETTING_KEYS.VAT_RATE_PERCENT, String(nextRate)]
        );
    }

    if (updateEnabled) {
        nextEnabled = normalizeVatEnabled(vatEnabled);
        await queryRunner.query(
            `
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            `,
            [SETTING_KEYS.VAT_ENABLED, nextEnabled ? '1' : '0']
        );
    }

    const snapshot = await getPriceUpdateSettings(queryRunner);

    await safeLogAuditEvent({
        action: 'tax_settings_updated',
        actorUserId,
        targetType: 'system_settings',
        targetId: null,
        details: {
            ...(updateRate ? { vat_rate_percent: snapshot.vat_rate_percent } : {}),
            ...(updateEnabled ? { vat_enabled: snapshot.vat_enabled } : {})
        },
        ipAddress
    });

    return snapshot;
};

const scheduleSinglePriceChange = async ({
    connection,
    itemId,
    priceScope,
    sizeOptionId = null,
    tempOptionId = null,
    currentPrice,
    scheduledPrice,
    effectiveAt,
    timezone,
    actorUserId = null,
    notes = null
}) => {
    const normalizedCurrentPrice = normalizePrice(currentPrice);
    const normalizedScheduledPrice = normalizePrice(scheduledPrice);

    if (normalizedScheduledPrice === null) {
        return { scheduled: false, reason: 'invalid_price' };
    }

    if (normalizedCurrentPrice !== null && normalizedCurrentPrice === normalizedScheduledPrice) {
        return { scheduled: false, reason: 'unchanged' };
    }

    const [pendingRows] = await connection.query(
        `
        SELECT schedule_id
        FROM item_price_schedules
        WHERE item_id = ?
        AND price_scope = ?
        AND status = 'pending'
        AND (size_option_id <=> ?)
        AND (temp_option_id <=> ?)
        FOR UPDATE
        `,
        [itemId, priceScope, sizeOptionId, tempOptionId]
    );

    const [insertResult] = await connection.query(
        `
        INSERT INTO item_price_schedules (
            item_id,
            price_scope,
            size_option_id,
            temp_option_id,
            current_price,
            scheduled_price,
            status,
            effective_at,
            timezone,
            notes,
            created_by,
            updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
        `,
        [
            itemId,
            priceScope,
            sizeOptionId,
            tempOptionId,
            normalizedCurrentPrice,
            normalizedScheduledPrice,
            effectiveAt,
            timezone,
            notes,
            actorUserId,
            actorUserId
        ]
    );

    const scheduleId = insertResult.insertId;

    if (pendingRows.length > 0) {
        await connection.query(
            `
            UPDATE item_price_schedules
            SET status = 'replaced',
                replaced_by_schedule_id = ?,
                updated_by = ?
            WHERE schedule_id IN (?)
            `,
            [scheduleId, actorUserId, pendingRows.map((row) => row.schedule_id)]
        );
    }

    return {
        scheduled: true,
        schedule_id: scheduleId,
        replaced_count: pendingRows.length,
        current_price: normalizedCurrentPrice,
        scheduled_price: normalizedScheduledPrice,
        effective_at: effectiveAt,
        timezone
    };
};

const scheduleBasePriceUpdate = async ({
    connection,
    itemId,
    newPrice,
    actorUserId = null,
    notes = null,
    settings = null
}) => {
    await ensurePriceSchedulesTable(connection);
    const effectiveSettings = settings || (await getPriceUpdateSettings(connection));

    const [rows] = await connection.query(
        `SELECT item_id, price FROM items WHERE item_id = ? LIMIT 1 FOR UPDATE`,
        [itemId]
    );

    if (rows.length === 0) {
        return { scheduled: false, reason: 'item_not_found' };
    }

    const currentPrice = normalizePrice(rows[0].price);
    const normalizedNewPrice = normalizePrice(newPrice);

    if (normalizedNewPrice === null) {
        return { scheduled: false, reason: 'invalid_price' };
    }

    const effectiveAt = effectiveAtFromDelayDays({
        delayDays: effectiveSettings.delay_days,
        timezone: effectiveSettings.timezone
    });

    const result = await scheduleSinglePriceChange({
        connection,
        itemId: Number(itemId),
        priceScope: PRICE_SCOPE.BASE,
        sizeOptionId: null,
        tempOptionId: null,
        currentPrice,
        scheduledPrice: normalizedNewPrice,
        effectiveAt,
        timezone: effectiveSettings.timezone,
        actorUserId,
        notes
    });

    return {
        ...result,
        delay_days: effectiveSettings.delay_days
    };
};

const getPendingPriceSchedules = async ({
    queryRunner = db,
    itemId = null,
    limit = 200
} = {}) => {
    await ensurePriceSchedulesTable(queryRunner);

    const params = [];
    const where = [`s.status = 'pending'`];

    if (itemId != null) {
        where.push('s.item_id = ?');
        params.push(Number(itemId));
    }

    params.push(Math.max(1, Math.min(Number(limit) || 200, 500)));

    const [rows] = await queryRunner.query(
        `
        SELECT
            s.schedule_id,
            s.item_id,
            i.name AS item_name,
            s.price_scope,
            s.size_option_id,
            s.temp_option_id,
            s.current_price,
            s.scheduled_price,
            s.status,
            s.effective_at,
            s.timezone,
            s.notes,
            s.created_by,
            s.updated_by,
            s.created_at,
            s.updated_at,
            su.full_name AS created_by_name,
            so.name AS size_option_name,
            topt.name AS temp_option_name
        FROM item_price_schedules s
        INNER JOIN items i ON i.item_id = s.item_id
        LEFT JOIN users su ON su.user_id = s.created_by
        LEFT JOIN customization_options so ON so.option_id = s.size_option_id
        LEFT JOIN customization_options topt ON topt.option_id = s.temp_option_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.effective_at ASC, s.schedule_id ASC
        LIMIT ?
        `,
        params
    );

    return rows;
};

const cancelPendingPriceSchedule = async ({
    connection,
    scheduleId,
    actorUserId = null,
    reason = null
}) => {
    await ensurePriceSchedulesTable(connection);

    const [rows] = await connection.query(
        `
        SELECT *
        FROM item_price_schedules
        WHERE schedule_id = ?
        AND status = 'pending'
        FOR UPDATE
        `,
        [scheduleId]
    );

    if (rows.length === 0) {
        return { cancelled: false, reason: 'not_found_or_not_pending' };
    }

    const settings = await getPriceUpdateSettings(connection);
    const cancelledAt = nowInTimezoneMysql(settings.timezone);
    const reasonSuffix = reason ? `Cancelled: ${String(reason).trim()}` : 'Cancelled by admin';

    await connection.query(
        `
        UPDATE item_price_schedules
        SET status = 'cancelled',
            cancelled_at = ?,
            updated_by = ?,
            notes = LEFT(CONCAT(COALESCE(notes, ''), CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE ' | ' END, ?), 255)
        WHERE schedule_id = ?
        `,
        [cancelledAt, actorUserId, reasonSuffix, scheduleId]
    );

    return {
        cancelled: true,
        schedule_id: Number(scheduleId),
        cancelled_at: cancelledAt,
        timezone: settings.timezone,
        schedule: rows[0]
    };
};

const replacePendingPriceSchedule = async ({
    connection,
    scheduleId,
    newPrice,
    actorUserId = null,
    notes = null
}) => {
    await ensurePriceSchedulesTable(connection);

    const [rows] = await connection.query(
        `
        SELECT *
        FROM item_price_schedules
        WHERE schedule_id = ?
        AND status = 'pending'
        FOR UPDATE
        `,
        [scheduleId]
    );

    if (rows.length === 0) {
        return { replaced: false, reason: 'not_found_or_not_pending' };
    }

    const oldSchedule = rows[0];
    let result = null;

    if (oldSchedule.price_scope === PRICE_SCOPE.BASE) {
        result = await scheduleBasePriceUpdate({
            connection,
            itemId: Number(oldSchedule.item_id),
            newPrice,
            actorUserId,
            notes: notes || `Replaced pending schedule #${scheduleId}`,
            settings: null
        });

        if (!result.scheduled) {
            return {
                replaced: false,
                reason: result.reason || 'unable_to_schedule'
            };
        }
    } else {
        const variantResult = await scheduleVariantPriceUpdates({
            connection,
            itemId: Number(oldSchedule.item_id),
            variantRows: [{
                size_option_id: numberOrNull(oldSchedule.size_option_id),
                temp_option_id: numberOrNull(oldSchedule.temp_option_id),
                price: newPrice,
                status: 'active'
            }],
            actorUserId,
            notes: notes || `Replaced pending schedule #${scheduleId}`,
            settings: null
        });

        if (Number(variantResult.scheduled_count || 0) === 0) {
            return {
                replaced: false,
                reason: 'unchanged'
            };
        }

        result = {
            scheduled: true,
            schedule_id: Number(variantResult.schedule_ids?.[0] || 0),
            replaced_count: Number(variantResult.replaced_count || 0),
            current_price: oldSchedule.current_price,
            scheduled_price: normalizePrice(newPrice),
            effective_at: variantResult.effective_at,
            delay_days: variantResult.delay_days,
            timezone: variantResult.timezone
        };
    }

    return {
        replaced: true,
        old_schedule_id: Number(scheduleId),
        new_schedule_id: Number(result.schedule_id || 0),
        effective_at: result.effective_at,
        delay_days: result.delay_days,
        timezone: result.timezone,
        old_schedule: oldSchedule,
        result
    };
};

const scheduleVariantPriceUpdates = async ({
    connection,
    itemId,
    variantRows,
    actorUserId = null,
    notes = null,
    settings = null
}) => {
    await ensurePriceSchedulesTable(connection);

    const effectiveSettings = settings || (await getPriceUpdateSettings(connection));

    const [activeRows] = await connection.query(
        `
        SELECT size_option_id, temp_option_id, price
        FROM item_variant_prices
        WHERE item_id = ?
        AND status = 'active'
        `,
        [itemId]
    );

    const existingPriceMap = new Map();
    for (const row of activeRows) {
        const key = `${numberOrNull(row.size_option_id) ?? 'null'}:${numberOrNull(row.temp_option_id) ?? 'null'}`;
        existingPriceMap.set(key, normalizePrice(row.price));
    }

    const effectiveAt = effectiveAtFromDelayDays({
        delayDays: effectiveSettings.delay_days,
        timezone: effectiveSettings.timezone
    });

    let scheduledCount = 0;
    let replacedCount = 0;
    let unchangedCount = 0;
    const scheduleIds = [];

    for (const row of variantRows || []) {
        const sizeOptionId = numberOrNull(row.size_option_id);
        const tempOptionId = numberOrNull(row.temp_option_id);
        const key = `${sizeOptionId ?? 'null'}:${tempOptionId ?? 'null'}`;
        const currentPrice = existingPriceMap.get(key) ?? null;

        const result = await scheduleSinglePriceChange({
            connection,
            itemId: Number(itemId),
            priceScope: PRICE_SCOPE.VARIANT,
            sizeOptionId,
            tempOptionId,
            currentPrice,
            scheduledPrice: row.price,
            effectiveAt,
            timezone: effectiveSettings.timezone,
            actorUserId,
            notes
        });

        if (result.scheduled) {
            scheduledCount += 1;
            replacedCount += Number(result.replaced_count || 0);
            scheduleIds.push(result.schedule_id);
        } else if (result.reason === 'unchanged') {
            unchangedCount += 1;
        }
    }

    return {
        scheduled_count: scheduledCount,
        replaced_count: replacedCount,
        unchanged_count: unchangedCount,
        schedule_ids: scheduleIds,
        effective_at: effectiveAt,
        delay_days: effectiveSettings.delay_days,
        timezone: effectiveSettings.timezone
    };
};

const applyDuePriceSchedules = async ({ limit = 250 } = {}) => {
    await ensurePriceSchedulesTable(db);

    const settings = await getPriceUpdateSettings(db);
    const nowManila = nowInTimezoneMysql(settings.timezone);

    const [dueRows] = await db.query(
        `
        SELECT
            schedule_id,
            item_id,
            price_scope,
            size_option_id,
            temp_option_id,
            scheduled_price,
            effective_at
        FROM item_price_schedules
        WHERE status = 'pending'
        AND effective_at <= ?
        ORDER BY effective_at ASC, schedule_id ASC
        LIMIT ?
        `,
        [nowManila, Math.max(1, Number(limit) || 250)]
    );

    if (dueRows.length === 0) {
        return {
            scanned_count: 0,
            applied_count: 0,
            failed_count: 0,
            now: nowManila,
            timezone: settings.timezone
        };
    }

    let appliedCount = 0;
    let failedCount = 0;

    for (const row of dueRows) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [lockedRows] = await connection.query(
                `
                SELECT schedule_id, status, price_scope, item_id, size_option_id, temp_option_id, scheduled_price
                FROM item_price_schedules
                WHERE schedule_id = ?
                FOR UPDATE
                `,
                [row.schedule_id]
            );

            if (lockedRows.length === 0 || lockedRows[0].status !== 'pending') {
                await connection.rollback();
                continue;
            }

            const schedule = lockedRows[0];
            const scheduledPrice = normalizePrice(schedule.scheduled_price);
            if (scheduledPrice === null) {
                throw new Error('Invalid scheduled price.');
            }

            if (schedule.price_scope === PRICE_SCOPE.BASE) {
                await connection.query(
                    `UPDATE items SET price = ? WHERE item_id = ?`,
                    [scheduledPrice, schedule.item_id]
                );
            } else {
                const [updateResult] = await connection.query(
                    `
                    UPDATE item_variant_prices
                    SET price = ?, status = 'active'
                    WHERE item_id = ?
                    AND (size_option_id <=> ?)
                    AND (temp_option_id <=> ?)
                    `,
                    [
                        scheduledPrice,
                        schedule.item_id,
                        numberOrNull(schedule.size_option_id),
                        numberOrNull(schedule.temp_option_id)
                    ]
                );

                if (Number(updateResult.affectedRows || 0) === 0) {
                    await connection.query(
                        `
                        INSERT INTO item_variant_prices (
                            item_id,
                            size_option_id,
                            temp_option_id,
                            price,
                            status
                        ) VALUES (?, ?, ?, ?, 'active')
                        `,
                        [
                            schedule.item_id,
                            numberOrNull(schedule.size_option_id),
                            numberOrNull(schedule.temp_option_id),
                            scheduledPrice
                        ]
                    );
                }
            }

            await connection.query(
                `
                UPDATE item_price_schedules
                SET status = 'applied',
                    applied_at = ?,
                    updated_by = NULL
                WHERE schedule_id = ?
                `,
                [nowManila, schedule.schedule_id]
            );

            await connection.commit();
            appliedCount += 1;

            await safeLogAuditEvent({
                action: 'price_update_applied',
                actorUserId: null,
                targetType: 'item',
                targetId: Number(schedule.item_id),
                details: {
                    schedule_id: Number(schedule.schedule_id),
                    price_scope: schedule.price_scope,
                    size_option_id: numberOrNull(schedule.size_option_id),
                    temp_option_id: numberOrNull(schedule.temp_option_id),
                    scheduled_price: scheduledPrice,
                    effective_at: row.effective_at,
                    applied_at: nowManila
                },
                ipAddress: null
            });
        } catch (error) {
            await connection.rollback();
            failedCount += 1;

            const failureNote = String(error.message || 'Unknown apply error').slice(0, 160);
            try {
                await db.query(
                    `
                    UPDATE item_price_schedules
                    SET status = 'failed',
                        notes = LEFT(CONCAT(COALESCE(notes, ''), CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE ' | ' END, 'Apply failed: ', ?), 255),
                        updated_by = NULL
                    WHERE schedule_id = ?
                    AND status = 'pending'
                    `,
                    [failureNote, row.schedule_id]
                );
            } catch (_secondaryError) {
                // Ignore secondary update failures to keep loop resilient.
            }

            await safeLogAuditEvent({
                action: 'price_update_failed',
                actorUserId: null,
                targetType: 'item_price_schedule',
                targetId: Number(row.schedule_id),
                details: {
                    schedule_id: Number(row.schedule_id),
                    item_id: Number(row.item_id),
                    price_scope: row.price_scope,
                    effective_at: row.effective_at,
                    error: String(error.message || 'Unknown apply error').slice(0, 255)
                },
                ipAddress: null
            });
        } finally {
            connection.release();
        }
    }

    return {
        scanned_count: dueRows.length,
        applied_count: appliedCount,
        failed_count: failedCount,
        now: nowManila,
        timezone: settings.timezone
    };
};

const getPendingPriceSchedulesByItem = async (itemId, queryRunner = db) => {
    await ensurePriceSchedulesTable(queryRunner);

    const [rows] = await queryRunner.query(
        `
        SELECT
            schedule_id,
            item_id,
            price_scope,
            size_option_id,
            temp_option_id,
            current_price,
            scheduled_price,
            status,
            effective_at,
            timezone,
            created_at
        FROM item_price_schedules
        WHERE item_id = ?
        AND status = 'pending'
        ORDER BY effective_at ASC, schedule_id ASC
        `,
        [itemId]
    );

    return rows;
};

const getPriceUpdateNotices = async ({
    queryRunner = db,
    windowHours = 24,
    maxItems = 20
} = {}) => {
    await ensurePriceSchedulesTable(queryRunner);

    const settings = await getPriceUpdateSettings(queryRunner);
    const nowManila = nowInTimezoneMysql(settings.timezone);
    const horizon = addHoursToTimezoneMysqlDateTime({
        sourceDateTime: nowManila,
        timezone: settings.timezone,
        hours: Number(windowHours) || 24
    });

    const [todayRows] = await queryRunner.query(
        `
        SELECT COUNT(*) AS total
        FROM item_price_schedules
        WHERE status = 'pending'
        AND effective_at >= ?
        AND DATE(effective_at) = DATE(?)
        `,
        [nowManila, nowManila]
    );

    const [upcomingRows] = await queryRunner.query(
        `
        SELECT COUNT(*) AS total
        FROM item_price_schedules
        WHERE status = 'pending'
        AND effective_at >= ?
        AND effective_at <= ?
        `,
        [nowManila, horizon]
    );

    const [rows] = await queryRunner.query(
        `
        SELECT
            s.schedule_id,
            s.item_id,
            i.name AS item_name,
            s.price_scope,
            s.size_option_id,
            s.temp_option_id,
            s.current_price,
            s.scheduled_price,
            s.effective_at,
            s.timezone,
            so.name AS size_option_name,
            topt.name AS temp_option_name
        FROM item_price_schedules s
        INNER JOIN items i ON i.item_id = s.item_id
        LEFT JOIN customization_options so ON so.option_id = s.size_option_id
        LEFT JOIN customization_options topt ON topt.option_id = s.temp_option_id
        WHERE s.status = 'pending'
        AND s.effective_at >= ?
        AND s.effective_at <= ?
        ORDER BY s.effective_at ASC, s.schedule_id ASC
        LIMIT ?
        `,
        [nowManila, horizon, Math.max(1, Math.min(Number(maxItems) || 20, 100))]
    );

    const effectiveTodayCount = Number(todayRows?.[0]?.total || 0);
    const upcomingCount = Number(upcomingRows?.[0]?.total || 0);

    return {
        timezone: settings.timezone,
        now: nowManila,
        window_hours: Number(windowHours) || 24,
        effective_today_count: effectiveTodayCount,
        upcoming_24h_count: upcomingCount,
        has_notice: upcomingCount > 0,
        schedules: rows
    };
};

module.exports = {
    DEFAULT_DELAY_DAYS,
    DEFAULT_TIMEZONE,
    DEFAULT_VAT_RATE_PERCENT,
    ALLOWED_DELAY_DAYS,
    PRICE_SCOPE,
    normalizeVatRatePercent,
    normalizeVatEnabled,
    getPriceUpdateSettings,
    updatePriceUpdateDelayDays,
    updateTaxSettings,
    scheduleBasePriceUpdate,
    scheduleVariantPriceUpdates,
    getPendingPriceSchedules,
    cancelPendingPriceSchedule,
    replacePendingPriceSchedule,
    applyDuePriceSchedules,
    getPendingPriceSchedulesByItem,
    getPriceUpdateNotices,
    nowInTimezoneMysql,
    effectiveAtFromDelayDays
};
