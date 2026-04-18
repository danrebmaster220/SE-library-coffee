/**
 * VAT-inclusive breakdown (Philippines-style): menu/total price includes VAT.
 * VAT = totalIncl * (r / (100 + r)) where r is percent (e.g. 12).
 * Net (vatable base) = totalIncl - VAT.
 */

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

/**
 * @param {object} opts
 * @param {number} opts.totalIncl - Final charge (after discount), inclusive
 * @param {boolean} opts.vatEnabled
 * @param {number} opts.vatRatePercent - e.g. 12
 * @returns {{ vat_enabled_snapshot: 0|1, vat_rate_snapshot: number|null, vat_amount: number, vatable_sales: number, non_vatable_sales: number, net_vatable_sales: number }}
 */
function computeTransactionTaxSnapshot({ totalIncl, vatEnabled, vatRatePercent }) {
    const total = roundMoney(Math.max(0, Number(totalIncl) || 0));
    const rate = Number(vatRatePercent);
    const safeRate = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0;

    if (!vatEnabled || safeRate <= 0 || total <= 0) {
        return {
            vat_enabled_snapshot: 0,
            vat_rate_snapshot: safeRate > 0 ? roundMoney(safeRate) : null,
            vat_amount: 0,
            vatable_sales: 0,
            non_vatable_sales: total,
            net_vatable_sales: 0
        };
    }

    const r = safeRate / 100;
    const vat = roundMoney((total * r) / (1 + r));
    const net = roundMoney(total - vat);

    return {
        vat_enabled_snapshot: 1,
        vat_rate_snapshot: roundMoney(safeRate),
        vat_amount: vat,
        vatable_sales: total,
        non_vatable_sales: 0,
        net_vatable_sales: net
    };
}

module.exports = {
    roundMoney,
    computeTransactionTaxSnapshot
};
