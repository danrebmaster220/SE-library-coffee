const db = require('../config/db');

const formatHourLabel = (hour24) => {
    const h = ((Number(hour24) % 24) + 24) % 24;
    if (h === 0) return '12MN';
    if (h === 12) return '12NN';
    if (h < 12) return `${h}AM`;
    return `${h - 12}PM`;
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        // Today's sales and orders
        const [salesData] = await db.query(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as total_sales,
                CASE
                    WHEN COUNT(*) > 0 THEN (COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0)) / COUNT(*)
                    ELSE 0
                END as avg_order_value,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vat,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN (t.vatable_sales - t.vat_amount) * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vatable_base,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.non_vatable_sales * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_non_vatable
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE DATE(t.created_at) = CURDATE()
            AND t.status NOT IN ('voided', 'pending')
        `);

        // Order status counts for today
        const [orderCounts] = await db.query(`
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing,
                SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM transactions 
            WHERE DATE(created_at) = CURDATE()
            AND status NOT IN ('voided', 'refunded')
        `);

        // Unique customers today (by beeper number as proxy)
        const [customerData] = await db.query(`
            SELECT COUNT(DISTINCT beeper_number) as unique_customers
            FROM transactions 
            WHERE DATE(created_at) = CURDATE()
            AND status NOT IN ('voided', 'pending')
        `);

        // Library seats status
        const [seats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
                SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
            FROM library_seats
        `);

        const [cupSettingRows] = await db.query(
            `
            SELECT setting_value
            FROM system_settings
            WHERE setting_key = 'takeout_cups_stock'
            LIMIT 1
            `
        );

        const [cupsUsedRows] = await db.query(`
            SELECT COALESCE(
                SUM(
                    CASE WHEN COALESCE(c.requires_takeout_cup, 1) = 1
                    THEN ti.quantity
                    ELSE 0 END
                ),
                0
            ) as cups_used_today
            FROM transactions t
            JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
            JOIN items i ON i.item_id = ti.item_id
            JOIN categories c ON c.category_id = i.category_id
            WHERE DATE(t.created_at) = CURDATE()
            AND t.order_type = 'takeout'
            AND t.status NOT IN ('pending', 'voided')
        `);

        const cupStock = Number.parseInt(String(cupSettingRows?.[0]?.setting_value ?? '200'), 10);
        const takeoutCupStock = Number.isNaN(cupStock) ? 200 : Math.max(0, cupStock);
        const takeoutCupsUsedToday = Number.parseInt(String(cupsUsedRows?.[0]?.cups_used_today ?? '0'), 10) || 0;

        res.json({
            todaySales: parseFloat(salesData[0]?.total_sales || 0),
            totalOrders: parseInt(salesData[0]?.total_orders || 0),
            pendingOrders: parseInt(orderCounts[0]?.pending || 0),
            preparingOrders: parseInt(orderCounts[0]?.preparing || 0),
            readyOrders: parseInt(orderCounts[0]?.ready || 0),
            completedOrders: parseInt(orderCounts[0]?.completed || 0),
            uniqueCustomers: parseInt(customerData[0]?.unique_customers || 0),
            avgOrderValue: parseFloat(salesData[0]?.avg_order_value || 0),
            librarySeats: {
                total: parseInt(seats[0]?.total || 0),
                available: parseInt(seats[0]?.available || 0),
                occupied: parseInt(seats[0]?.occupied || 0),
                maintenance: parseInt(seats[0]?.maintenance || 0)
            },
            takeoutCups: {
                stock: takeoutCupStock,
                used_today: takeoutCupsUsedToday,
                is_takeout_disabled: takeoutCupStock <= 0
            },
            taxToday: {
                net_vat: parseFloat(salesData[0]?.net_vat || 0),
                net_vatable_base: parseFloat(salesData[0]?.net_vatable_base || 0),
                net_non_vatable: parseFloat(salesData[0]?.net_non_vatable || 0)
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get library status for dashboard
exports.getLibraryStatus = async (req, res) => {
    try {
        const [seats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
                SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
            FROM library_seats
        `);

        res.json({
            total: parseInt(seats[0]?.total || 0),
            available: parseInt(seats[0]?.available || 0),
            occupied: parseInt(seats[0]?.occupied || 0),
            maintenance: parseInt(seats[0]?.maintenance || 0)
        });
    } catch (error) {
        console.error('Library status error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get sales chart data - returns all periods
exports.getSalesChart = async (req, res) => {
    try {
        // ── DAILY: sales per day of current week (Mon–Sun) ──
        const [dailyWeekData] = await db.query(`
            SELECT 
                DAYOFWEEK(t.created_at) as day_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vat
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE YEARWEEK(t.created_at, 1) = YEARWEEK(CURDATE(), 1)
            AND t.status NOT IN ('voided', 'pending')
            GROUP BY DAYOFWEEK(t.created_at)
            ORDER BY day_num ASC
        `);

        // Fill in all days of week (Monday first)
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayNums = [2, 3, 4, 5, 6, 7, 1]; // MySQL DAYOFWEEK: 1=Sun, 2=Mon, etc.
        const dailyData = dayNames.map((day, idx) => {
            const found = dailyWeekData.find(d => d.day_num === dayNums[idx]);
            return {
                day: day,
                sales: found ? parseFloat(found.sales) : 0,
                net_vat: found ? parseFloat(found.net_vat) : 0
            };
        });

        // ── WEEKLY: sales per week of current month (Week 1–5) ──
        const [weekOfMonthData] = await db.query(`
            SELECT 
                CEIL(DAY(t.created_at) / 7) as week_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vat
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE MONTH(t.created_at) = MONTH(CURDATE())
            AND YEAR(t.created_at) = YEAR(CURDATE())
            AND t.status NOT IN ('voided', 'pending')
            GROUP BY CEIL(DAY(t.created_at) / 7)
            ORDER BY week_num ASC
        `);

        // Determine how many weeks the current month has
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalWeeks = Math.ceil(daysInMonth / 7);
        const weeklyData = [];
        for (let w = 1; w <= totalWeeks; w++) {
            const found = weekOfMonthData.find(d => Number(d.week_num) === w);
            weeklyData.push({
                week: `Week ${w}`,
                sales: found ? parseFloat(found.sales) : 0,
                net_vat: found ? parseFloat(found.net_vat) : 0
            });
        }

        // ── MONTHLY: sales per calendar month for current year (Jan–Dec) ──
        const [monthOfYearData] = await db.query(`
            SELECT 
                MONTH(t.created_at) as month_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vat
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE YEAR(t.created_at) = YEAR(CURDATE())
            AND t.status NOT IN ('voided', 'pending')
            GROUP BY MONTH(t.created_at)
            ORDER BY month_num ASC
        `);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = monthNames.map((month, idx) => {
            const found = monthOfYearData.find(d => d.month_num === idx + 1);
            return {
                month,
                sales: found ? parseFloat(found.sales) : 0,
                net_vat: found ? parseFloat(found.net_vat) : 0
            };
        });

        // ── YEARLY: rolling 5-year window ending in current calendar year ──
        const [multiYearRows] = await db.query(`
            SELECT 
                YEAR(t.created_at) as year_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales,
                COALESCE(SUM(
                    CASE
                        WHEN t.total_amount > 0 THEN t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount))
                        ELSE 0
                    END
                ), 0) as net_vat
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE YEAR(t.created_at) BETWEEN YEAR(CURDATE()) - 4 AND YEAR(CURDATE())
            AND t.status NOT IN ('voided', 'pending')
            GROUP BY YEAR(t.created_at)
            ORDER BY year_num ASC
        `);

        const [currentYearRows] = await db.query(`SELECT YEAR(CURDATE()) AS cy`);
        const endYear = Number(currentYearRows[0]?.cy ?? new Date().getFullYear());
        const startYear = endYear - 4;
        const yearlyData = [];
        for (let y = startYear; y <= endYear; y += 1) {
            const found = multiYearRows.find((d) => Number(d.year_num) === y);
            yearlyData.push({
                year: String(y),
                sales: found ? parseFloat(found.sales) : 0,
                net_vat: found ? parseFloat(found.net_vat) : 0
            });
        }

        res.json({
            daily: dailyData,
            weekly: weeklyData,
            monthly: monthlyData,
            yearly: yearlyData
        });
    } catch (error) {
        console.error('Sales chart error:', error);
        res.status(500).json({ error: error.message });
    }
};

/** Date window for category sales — each period covers a distinct time range. */
const getCategorySalesDateClause = (periodRaw) => {
    const p = String(periodRaw || 'daily').toLowerCase();
    switch (p) {
        case 'daily':
        case 'today':  // legacy fallback
            return 'DATE(t.created_at) = CURDATE()';
        case 'weekly':
            return 'YEARWEEK(t.created_at, 1) = YEARWEEK(CURDATE(), 1)';
        case 'monthly':
            return 'MONTH(t.created_at) = MONTH(CURDATE()) AND YEAR(t.created_at) = YEAR(CURDATE())';
        case 'yearly':
            return 'YEAR(t.created_at) = YEAR(CURDATE())';
        default:
            return 'DATE(t.created_at) = CURDATE()';
    }
};

// Get sales by category (period: today | weekly | monthly | yearly)
exports.getCategorySales = async (req, res) => {
    try {
        const dateClause = getCategorySalesDateClause(req.query.period);

        const [categorySales] = await db.query(`
            SELECT 
                c.category_id,
                c.name as category_name,
                COALESCE(
                    SUM(
                        CASE
                            WHEN t.transaction_id IS NULL THEN 0
                            WHEN t.status = 'refunded' AND COALESCE(vl.refund_amount, 0) > 0 THEN 0
                            ELSE ti.total_price
                        END
                    ),
                    0
                ) as total_sales,
                COALESCE(
                    SUM(
                        CASE
                            WHEN t.transaction_id IS NULL THEN 0
                            WHEN t.status = 'refunded' AND COALESCE(vl.refund_amount, 0) > 0 THEN 0
                            WHEN t.total_amount > 0 AND COALESCE(tls.line_sum, 0) > 0 THEN
                                (t.vat_amount * (1 - LEAST(1, COALESCE(vl.refund_amount, 0) / t.total_amount)))
                                * (ti.total_price / tls.line_sum)
                            ELSE 0
                        END
                    ),
                    0
                ) as net_vat
            FROM categories c
            LEFT JOIN items i ON c.category_id = i.category_id
            LEFT JOIN transaction_items ti ON i.item_id = ti.item_id
            LEFT JOIN transactions t ON ti.transaction_id = t.transaction_id 
                AND (${dateClause})
                AND t.status NOT IN ('voided', 'pending')
            LEFT JOIN (
                SELECT transaction_id, SUM(total_price) as line_sum
                FROM transaction_items
                GROUP BY transaction_id
            ) tls ON tls.transaction_id = t.transaction_id
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE c.status = 'active'
            GROUP BY c.category_id, c.name
            ORDER BY total_sales DESC, c.name ASC
        `);

        const result = (categorySales || []).map((row) => ({
            category_id: row.category_id,
            category_name: row.category_name,
            category: row.category_name,
            total_sales: parseFloat(row.total_sales || 0),
            net_vat: parseFloat(row.net_vat || 0)
        }));

        res.json(result);
    } catch (error) {
        console.error('Category sales error:', error);
        res.status(500).json({ error: error.message });
    }
};
