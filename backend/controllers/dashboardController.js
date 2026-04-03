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
                END as avg_order_value
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
        // Hourly sales for today
        const [todayData] = await db.query(`
            SELECT 
                HOUR(t.created_at) as hour,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales
            FROM transactions t
            LEFT JOIN (
                SELECT transaction_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
                FROM void_log
                WHERE action_type = 'refund'
                GROUP BY transaction_id
            ) vl ON vl.transaction_id = t.transaction_id
            WHERE DATE(t.created_at) = CURDATE()
            AND t.status NOT IN ('voided', 'pending')
            GROUP BY HOUR(t.created_at)
            ORDER BY hour ASC
        `);
        
        // Fill in missing hours based on operating window (8AM-11PM)
        // Labels use 12NN/12MN to avoid ambiguous duplicate 12PM formatting.
        const hourlyData = [];
        for (let h = 8; h <= 23; h++) {
            const found = todayData.find(d => d.hour === h);
            const hourLabel = formatHourLabel(h);
            hourlyData.push({
                hour: hourLabel,
                sales: found ? parseFloat(found.sales) : 0
            });
        }

        // Daily sales for current week
        const [weekData] = await db.query(`
            SELECT 
                DAYOFWEEK(t.created_at) as day_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales
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
        const weeklyData = dayNames.map((day, idx) => {
            const found = weekData.find(d => d.day_num === dayNums[idx]);
            return {
                day: day,
                sales: found ? parseFloat(found.sales) : 0
            };
        });

        // Weekly sales for current month
        const [monthData] = await db.query(`
            SELECT 
                WEEK(t.created_at, 1) - WEEK(DATE_FORMAT(t.created_at, '%Y-%m-01'), 1) + 1 as week_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales
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
            GROUP BY week_num
            ORDER BY week_num ASC
        `);
        
        // Fill in 4 weeks
        const monthlyData = [];
        for (let w = 1; w <= 4; w++) {
            const found = monthData.find(d => d.week_num === w);
            monthlyData.push({
                week: `Week ${w}`,
                sales: found ? parseFloat(found.sales) : 0
            });
        }

        // Monthly sales for current year
        const [yearData] = await db.query(`
            SELECT 
                MONTH(t.created_at) as month_num,
                COALESCE(SUM(t.total_amount), 0) - COALESCE(SUM(COALESCE(vl.refund_amount, 0)), 0) as sales
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
        
        // Fill in all 12 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yearlyData = monthNames.map((month, idx) => {
            const found = yearData.find(d => d.month_num === idx + 1);
            return {
                month: month,
                sales: found ? parseFloat(found.sales) : 0
            };
        });

        res.json({
            today: hourlyData,
            weekly: weeklyData,
            monthly: monthlyData,
            yearly: yearlyData
        });
    } catch (error) {
        console.error('Sales chart error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get sales by category
exports.getCategorySales = async (req, res) => {
    try {
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
                ) as total_sales
            FROM categories c
            LEFT JOIN items i ON c.category_id = i.category_id
            LEFT JOIN transaction_items ti ON i.item_id = ti.item_id
            LEFT JOIN transactions t ON ti.transaction_id = t.transaction_id 
                AND DATE(t.created_at) = CURDATE()
                AND t.status NOT IN ('voided', 'pending')
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
            total_sales: parseFloat(row.total_sales || 0)
        }));

        res.json(result);
    } catch (error) {
        console.error('Category sales error:', error);
        res.status(500).json({ error: error.message });
    }
};
