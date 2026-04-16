const { resolveDisplayName } = require('./userName');

const PIN_REGEX = /^\d{6}$/;

const normalizeAdminPin = (value) => String(value ?? '').trim();

const isValidAdminPinFormat = (pin) => PIN_REGEX.test(normalizeAdminPin(pin));

const verifyAdminPinAgainstAdmins = async ({ queryRunner, bcryptLib, pin }) => {
    const normalizedPin = normalizeAdminPin(pin);

    if (!isValidAdminPinFormat(normalizedPin)) {
        return {
            valid: false,
            status: 400,
            error: 'Authorization PIN must be exactly 6 digits.'
        };
    }

    const [admins] = await queryRunner.query(
        `SELECT
            u.user_id,
            u.username,
            u.full_name,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.admin_pin_hash,
            COALESCE(u.must_change_pin, 0) as must_change_pin
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         WHERE u.status = 'active'
           AND LOWER(r.role_name) = 'admin'
           AND u.admin_pin_hash IS NOT NULL
           AND TRIM(u.admin_pin_hash) <> ''`
    );

    if (!admins.length) {
        return {
            valid: false,
            status: 409,
            error: 'No admin PIN has been configured yet. Set an admin PIN in Config first.'
        };
    }

    for (const admin of admins) {
        const matched = await bcryptLib.compare(normalizedPin, admin.admin_pin_hash);
        if (!matched) continue;

        return {
            valid: true,
            status: 200,
            admin: {
                id: admin.user_id,
                username: admin.username,
                fullName: resolveDisplayName(admin),
                must_change_pin: Boolean(admin.must_change_pin)
            }
        };
    }

    return {
        valid: false,
        status: 401,
        error: 'Invalid admin PIN.'
    };
};

module.exports = {
    normalizeAdminPin,
    isValidAdminPinFormat,
    verifyAdminPinAgainstAdmins
};
