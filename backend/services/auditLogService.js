const db = require('../config/db');

const isMissingAuditTableError = (error) => {
    if (!error) return false;
    const message = String(error.message || '').toLowerCase();
    return message.includes('audit_logs') && (message.includes('doesn\'t exist') || message.includes('unknown table'));
};

const logAuditEvent = async ({
    action,
    actorUserId = null,
    targetType = null,
    targetId = null,
    details = null,
    ipAddress = null
}) => {
    if (!action) {
        throw new Error('Audit action is required.');
    }

    try {
        await db.query(
            `
            INSERT INTO audit_logs (
                action,
                actor_user_id,
                target_type,
                target_id,
                details_json,
                ip_address
            ) VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                action,
                actorUserId,
                targetType,
                targetId,
                details ? JSON.stringify(details) : null,
                ipAddress
            ]
        );
    } catch (error) {
        if (isMissingAuditTableError(error)) {
            return;
        }
        throw error;
    }
};

module.exports = {
    logAuditEvent
};
