/**
 * Single source of truth for Study Hall (library) prepaid booking rates.
 * Used by libraryController (POS), kiosk order validation, and GET /library/pricing.
 */

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const LIBRARY_PRICING = {
    BASE_RATE: 100, // ₱ for first block
    BASE_MINUTES: 120, // 2 hours
    EXTEND_RATE: 50, // ₱ per extension block
    EXTEND_MINUTES: 30 // minutes per extension block
};

/** Upper bound for kiosk prepaid duration (sanity / abuse guard). */
const MAX_KIOSK_BOOKING_DURATION_MINUTES = 24 * 60;

/**
 * Fee for a prepaid duration (same rules as legacy calculateAmount in libraryController).
 * @param {number} minutes
 * @returns {number|null} null if minutes invalid
 */
function calculateAmountFromDurationMinutes(minutes) {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) {
        return null;
    }
    if (m <= LIBRARY_PRICING.BASE_MINUTES) {
        return roundMoney(LIBRARY_PRICING.BASE_RATE);
    }
    const extraMinutes = m - LIBRARY_PRICING.BASE_MINUTES;
    const extraBlocks = Math.ceil(extraMinutes / LIBRARY_PRICING.EXTEND_MINUTES);
    return roundMoney(LIBRARY_PRICING.BASE_RATE + (extraBlocks * LIBRARY_PRICING.EXTEND_RATE));
}

function getLibraryPricingPublic() {
    return {
        base_rate: LIBRARY_PRICING.BASE_RATE,
        base_minutes: LIBRARY_PRICING.BASE_MINUTES,
        extend_rate: LIBRARY_PRICING.EXTEND_RATE,
        extend_minutes: LIBRARY_PRICING.EXTEND_MINUTES
    };
}

module.exports = {
    LIBRARY_PRICING,
    MAX_KIOSK_BOOKING_DURATION_MINUTES,
    calculateAmountFromDurationMinutes,
    getLibraryPricingPublic,
    roundMoney
};
