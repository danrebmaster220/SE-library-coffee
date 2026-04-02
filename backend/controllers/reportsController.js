const db = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const buildAuditLogsWhereClause = ({ startDate, endDate, action, actorUserId, targetType, search }) => {
    const whereConditions = ['1=1'];
    const params = [];

    if (startDate) {
        whereConditions.push('DATE(a.created_at) >= ?');
        params.push(startDate);
    }

    if (endDate) {
        whereConditions.push('DATE(a.created_at) <= ?');
        params.push(endDate);
    }

    if (action) {
        whereConditions.push('a.action = ?');
        params.push(action);
    }

    if (actorUserId) {
        whereConditions.push('a.actor_user_id = ?');
        params.push(actorUserId);
    }

    if (targetType) {
        whereConditions.push('a.target_type = ?');
        params.push(targetType);
    }

    if (search) {
        whereConditions.push(`
            (
                a.action LIKE ?
                OR COALESCE(u.full_name, '') LIKE ?
                OR COALESCE(u.username, '') LIKE ?
                OR COALESCE(a.target_type, '') LIKE ?
                OR CAST(COALESCE(a.target_id, '') AS CHAR) LIKE ?
                OR COALESCE(a.ip_address, '') LIKE ?
            )
        `);
        const wildcard = `%${search}%`;
        params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    return {
        whereClause: whereConditions.join(' AND '),
        params
    };
};

const formatAuditActionLabel = (action) => String(action || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const stringifyAuditDetails = (details) => {
    if (!details) return '-';

    let parsed = details;
    if (typeof details === 'string') {
        try {
            parsed = JSON.parse(details);
        } catch (_error) {
            return details;
        }
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return String(parsed);
    }

    const text = Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');

    return text || '-';
};


// SALES SUMMARY (by date range) - Uses transactions table

exports.getSalesSummary = async (req, res) => {
    const { startDate, endDate, cashierUserId } = req.query;

    try {
        let whereConditions = ["t.status != 'voided'"];
        const params = [];

        if (startDate && endDate) {
            whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
            params.push(startDate, endDate);
        } else {
            // Default to today
            whereConditions.push('DATE(t.created_at) = CURDATE()');
        }

        if (cashierUserId) {
            whereConditions.push('t.processed_by = ?');
            params.push(cashierUserId);
        }

        const whereClause = whereConditions.join(' AND ');

        const [summary] = await db.query(`
            SELECT 
                COUNT(t.transaction_id) as total_orders,
                COALESCE(SUM(t.subtotal), 0) as total_sales,
                COALESCE(AVG(t.total_amount), 0) as average_order_value,
                COALESCE(SUM(t.discount_amount), 0) as total_discounts
            FROM transactions t
            WHERE ${whereClause}
        `, params);

        res.json(summary[0] || { total_orders: 0, total_sales: 0, average_order_value: 0, total_discounts: 0 });

    } catch (error) {
        console.error('Sales summary error:', error);
        res.status(500).json({ error: error.message });
    }
};


// SALES TREND (daily/weekly/monthly)

exports.getSalesTrend = async (req, res) => {
    const { period } = req.query; // 'daily', 'weekly', 'monthly'

    try {
        let groupBy = '';
        let dateRange = '';

        if (period === 'daily') {
            groupBy = 'DATE(o.created_at)';
            dateRange = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        } else if (period === 'weekly') {
            groupBy = 'WEEK(o.created_at)';
            dateRange = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)';
        } else if (period === 'monthly') {
            groupBy = 'MONTH(o.created_at)';
            dateRange = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
        } else {
            // Default to daily
            groupBy = 'DATE(o.created_at)';
            dateRange = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        }

        const [trend] = await db.query(`
            SELECT 
                ${groupBy} as date_label,
                COUNT(o.order_id) as order_count,
                SUM(o.final_amount) as total_sales
            FROM orders o
            WHERE o.payment_status = 'paid'
            ${dateRange}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy} ASC
        `);

        res.json(trend);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// TOP PRODUCTS

exports.getTopProducts = async (req, res) => {
    const { limit } = req.query;
    const productLimit = limit || 10;

    try {
        const [products] = await db.query(`
            SELECT 
                i.name as product_name,
                c.name as category_name,
                COUNT(oi.order_item_id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * oi.price) as total_revenue
            FROM order_items oi
            JOIN items i ON oi.item_id = i.item_id
            JOIN categories c ON i.category_id = c.category_id
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.payment_status = 'paid'
            AND DATE(o.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY i.item_id, i.name, c.name
            ORDER BY total_quantity DESC
            LIMIT ?
        `, [parseInt(productLimit)]);

        res.json(products);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CATEGORY PERFORMANCE

exports.getCategoryPerformance = async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT 
                c.name as category_name,
                COUNT(DISTINCT oi.order_id) as order_count,
                SUM(oi.quantity) as total_items_sold,
                SUM(oi.quantity * oi.price) as total_revenue
            FROM order_items oi
            JOIN items i ON oi.item_id = i.item_id
            JOIN categories c ON i.category_id = c.category_id
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.payment_status = 'paid'
            AND DATE(o.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY c.category_id, c.name
            ORDER BY total_revenue DESC
        `);

        res.json(categories);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// LIBRARY USAGE STATS

exports.getLibraryStats = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(session_id) as total_sessions,
                SUM(total_minutes) as total_minutes,
                AVG(total_minutes) as avg_session_duration,
                SUM(amount_due) as total_revenue
            FROM library_sessions
            WHERE status = 'completed'
            AND DATE(start_time) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        res.json(stats[0]);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// HOURLY SALES (Peak hours)

exports.getHourlySales = async (req, res) => {
    try {
        const [hourly] = await db.query(`
            SELECT 
                HOUR(o.created_at) as hour,
                COUNT(o.order_id) as order_count,
                SUM(o.final_amount) as total_sales
            FROM orders o
            WHERE o.payment_status = 'paid'
            AND DATE(o.created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY HOUR(o.created_at)
            ORDER BY hour ASC
        `);

        res.json(hourly);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ORDERS REPORT (detailed list)

exports.getOrdersReport = async (req, res) => {
    const { startDate, endDate, orderType, status, cashierUserId } = req.query;

    try {
        let whereConditions = ['1=1'];
        const params = [];

        if (startDate && endDate) {
            whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        if (orderType) {
            whereConditions.push('t.order_type = ?');
            params.push(orderType);
        }

        if (status) {
            whereConditions.push('t.status = ?');
            params.push(status);
        }

        if (cashierUserId) {
            whereConditions.push('t.processed_by = ?');
            params.push(cashierUserId);
        }

        const [orders] = await db.query(`
            SELECT 
                t.transaction_id,
                t.order_type,
                t.beeper_number,
                t.subtotal,
                t.discount_amount,
                t.total_amount,
                t.cash_tendered,
                t.change_due,
                t.status,
                t.created_at,
                d.name as discount_name,
                COUNT(ti.transaction_item_id) as item_count
            FROM transactions t
            LEFT JOIN discounts d ON t.discount_id = d.discount_id
            LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY t.transaction_id, t.order_type, t.beeper_number, t.subtotal, t.discount_amount, t.total_amount, t.cash_tendered, t.change_due, t.status, t.created_at, d.name
            ORDER BY t.created_at DESC
        `, params);

        res.json({ orders });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// SALES DETAILS (daily breakdown)

exports.getSalesDetails = async (req, res) => {
    const { startDate, endDate, cashierUserId } = req.query;

    try {
        let whereConditions = ["t.status != 'voided'"];
        const params = [];

        if (startDate && endDate) {
            whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        if (cashierUserId) {
            whereConditions.push('t.processed_by = ?');
            params.push(cashierUserId);
        }

        const [details] = await db.query(`
            SELECT 
                DATE(t.created_at) as date,
                COUNT(t.transaction_id) as transaction_count,
                SUM(t.subtotal) as gross_sales,
                SUM(COALESCE(t.discount_amount, 0)) as total_discounts,
                SUM(t.total_amount) as net_sales,
                AVG(t.total_amount) as avg_order_value
            FROM transactions t
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY DATE(t.created_at)
            ORDER BY DATE(t.created_at) DESC
        `, params);

        res.json(details);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// LIBRARY REPORT (session list with summary)

exports.getLibraryReport = async (req, res) => {
    const { startDate, endDate, status, search, cashierUserId } = req.query;
    console.log('Library report request:', { startDate, endDate, status, search, cashierUserId });

    try {
        let whereConditions = ['1=1'];
        const params = [];

        if (startDate && endDate) {
            whereConditions.push('DATE(ls.start_time) BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        if (status && status !== 'all') {
            whereConditions.push('ls.status = ?');
            params.push(status);
        }

        if (search) {
            whereConditions.push('(ls.customer_name LIKE ? OR ls.session_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (cashierUserId) {
            whereConditions.push(`
                EXISTS (
                    SELECT 1
                    FROM transactions t
                    WHERE t.library_session_id = ls.session_id
                    AND t.processed_by = ?
                    AND t.status != 'voided'
                )
            `);
            params.push(cashierUserId);
        }

        const whereClause = whereConditions.join(' AND ');
        console.log('Library report where clause:', whereClause, 'params:', params);

        // Get summary statistics
        const [summaryResult] = await db.query(`
            SELECT 
                COUNT(ls.session_id) as total_sessions,
                COALESCE(SUM(ls.amount_paid), 0) as total_revenue,
                COALESCE(SUM(ls.total_minutes), 0) as total_minutes
            FROM library_sessions ls
            WHERE ${whereClause}
        `, params);

        const summary = summaryResult[0] || { total_sessions: 0, total_revenue: 0, total_minutes: 0 };
        console.log('Library report summary:', summary);
        
        // Convert minutes to hours
        const totalHours = Math.round((summary.total_minutes / 60) * 100) / 100;

        // Get session list
        const [sessions] = await db.query(`
            SELECT 
                ls.session_id,
                ls.seat_id,
                s.seat_number,
                s.table_number,
                ls.customer_name,
                ls.start_time,
                ls.end_time,
                ls.paid_minutes,
                ls.total_minutes,
                ls.amount_paid,
                ls.amount_due,
                ls.status
            FROM library_sessions ls
            LEFT JOIN library_seats s ON ls.seat_id = s.seat_id
            WHERE ${whereClause}
            ORDER BY ls.start_time DESC
        `, params);
        console.log('Library report sessions count:', sessions.length);

        res.json({ 
            summary: {
                total_sessions: summary.total_sessions || 0,
                total_revenue: parseFloat(summary.total_revenue) || 0,
                total_hours: totalHours || 0
            },
            sessions 
        });

    } catch (error) {
        console.error('Library report error:', error);
        res.status(500).json({ error: error.message });
    }
};


// AUDIT LOGS REPORT

exports.getAuditLogs = async (req, res) => {
    const {
        startDate,
        endDate,
        action,
        actorUserId,
        targetType,
        search,
        page,
        limit
    } = req.query;

    try {
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
        const offset = (pageNum - 1) * limitNum;

        const { whereClause, params } = buildAuditLogsWhereClause({
            startDate,
            endDate,
            action,
            actorUserId,
            targetType,
            search
        });

        const [countRows] = await db.query(
            `
            SELECT COUNT(*) as total
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_user_id = u.user_id
            WHERE ${whereClause}
            `,
            params
        );

        const total = parseInt(countRows?.[0]?.total, 10) || 0;

        const [logs] = await db.query(
            `
            SELECT
                a.audit_id,
                a.action,
                a.actor_user_id,
                a.target_type,
                a.target_id,
                a.details_json,
                a.ip_address,
                a.created_at,
                u.full_name as actor_full_name,
                u.username as actor_username
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_user_id = u.user_id
            WHERE ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
            `,
            [...params, limitNum, offset]
        );

        res.json({
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Audit logs report error:', error);
        res.status(500).json({ error: error.message });
    }
};


// EXPORT TO EXCEL

exports.exportExcel = async (req, res) => {
    const { type, startDate, endDate, orderType, status, action, actorUserId, targetType, search, cashierUserId } = req.query;

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Library Coffee + Study POS';
        workbook.created = new Date();

        let filename = '';

        // Helper function to format currency
        const formatCurrency = (amount) => {
            return parseFloat(amount || 0).toFixed(2);
        };

        // Helper function to format date
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-PH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        };

        // Helper function to format datetime
        const formatDateTime = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleString('en-PH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Style definitions
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B4423' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            }
        };

        const summaryLabelStyle = {
            font: { bold: true, size: 11 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0E8' } },
            alignment: { horizontal: 'left', vertical: 'middle' }
        };

        const summaryValueStyle = {
            font: { bold: true, size: 11, color: { argb: 'FF6B4423' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0E8' } },
            alignment: { horizontal: 'right', vertical: 'middle' }
        };

        const cellBorder = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        if (type === 'orders') {
            // ============ ORDERS REPORT ============
            const worksheet = workbook.addWorksheet('Orders Report');
            filename = `Orders_Report_${startDate}_to_${endDate}.xlsx`;

            // Build query conditions
            let whereConditions = ['1=1'];
            const params = [];

            if (startDate && endDate) {
                whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }
            if (orderType) {
                whereConditions.push('t.order_type = ?');
                params.push(orderType);
            }
            if (status) {
                whereConditions.push('t.status = ?');
                params.push(status);
            }

            if (cashierUserId) {
                whereConditions.push('t.processed_by = ?');
                params.push(cashierUserId);
            }

            // Get orders data
            const [orders] = await db.query(`
                SELECT 
                    t.transaction_id,
                    t.created_at,
                    t.beeper_number,
                    t.order_type,
                    t.subtotal,
                    t.discount_amount,
                    t.total_amount,
                    t.status,
                    d.name as discount_name,
                    COUNT(ti.transaction_item_id) as item_count
                FROM transactions t
                LEFT JOIN discounts d ON t.discount_id = d.discount_id
                LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY t.transaction_id, t.created_at, t.beeper_number, t.order_type, t.subtotal, t.discount_amount, t.total_amount, t.status, d.name
                ORDER BY t.created_at DESC
            `, params);

            // Calculate summary (revenue only from completed orders)
            const totalOrders = orders.length;
            const completedOrders = orders.filter(o => o.status === 'completed').length;
            const voidedOrders = orders.filter(o => o.status === 'voided').length;
            const pendingOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'voided').length;
            const totalRevenue = orders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
            const totalDiscounts = orders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + parseFloat(o.discount_amount || 0), 0);
            const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

            // Title
            worksheet.mergeCells('A1:I1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ORDERS REPORT';
            titleCell.font = { bold: true, size: 16, color: { argb: 'FF6B4423' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 28;

            // Date Range
            worksheet.mergeCells('A2:I2');
            const dateRangeCell = worksheet.getCell('A2');
            dateRangeCell.value = `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`;
            dateRangeCell.font = { size: 11, color: { argb: 'FF666666' } };
            dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(2).height = 20;

            // Summary Section
            worksheet.getCell('A4').value = 'SUMMARY';
            worksheet.getCell('A4').font = { bold: true, size: 12 };
            
            // Summary data
            const summaryData = [
                ['Total Orders:', totalOrders],
                ['Completed Orders:', completedOrders],
                ['Voided Orders:', voidedOrders],
                ['Pending/Other:', pendingOrders],
                ['Total Revenue:', `₱${formatCurrency(totalRevenue)}`],
                ['Total Discounts:', `₱${formatCurrency(totalDiscounts)}`],
                ['Average Order Value:', `₱${formatCurrency(avgOrderValue)}`]
            ];

            let summaryRow = 5;
            summaryData.forEach(([label, value]) => {
                worksheet.getCell(`A${summaryRow}`).value = label;
                worksheet.getCell(`A${summaryRow}`).style = summaryLabelStyle;
                worksheet.getCell(`B${summaryRow}`).value = value;
                worksheet.getCell(`B${summaryRow}`).style = summaryValueStyle;
                summaryRow++;
            });

            // Empty row before data
            const dataStartRow = summaryRow + 1;

            // Headers
            const headers = ['Order #', 'Date/Time', 'Beeper', 'Order Type', 'Items', 'Subtotal', 'Discount', 'Total', 'Status'];
            headers.forEach((header, index) => {
                const cell = worksheet.getCell(dataStartRow, index + 1);
                cell.value = header;
                Object.assign(cell, headerStyle);
            });
            worksheet.getRow(dataStartRow).height = 22;

            // Data rows
            orders.forEach((order, index) => {
                const rowNum = dataStartRow + 1 + index;
                const row = worksheet.getRow(rowNum);
                
                const orderId = `ORD-${String(order.transaction_id).padStart(6, '0')}`;
                const isVoided = order.status === 'voided';
                
                row.getCell(1).value = orderId;
                row.getCell(2).value = formatDateTime(order.created_at);
                row.getCell(3).value = order.beeper_number || '-';
                row.getCell(4).value = order.order_type ? order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1).replace('_', ' ') : '-';
                row.getCell(5).value = order.item_count || 0;
                row.getCell(6).value = `₱${formatCurrency(order.subtotal)}`;
                row.getCell(7).value = order.discount_amount ? `₱${formatCurrency(order.discount_amount)}` : '-';
                row.getCell(8).value = `₱${formatCurrency(order.total_amount)}`;
                row.getCell(9).value = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : '-';

                // Apply borders and styles
                for (let col = 1; col <= 9; col++) {
                    const cell = row.getCell(col);
                    cell.border = cellBorder;
                    cell.alignment = { horizontal: col <= 2 || col === 4 || col === 9 ? 'left' : 'center', vertical: 'middle' };
                    
                    // Highlight voided rows
                    if (isVoided) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
                        cell.font = { color: { argb: 'FFF44336' } };
                    }
                    
                    // Style status cell
                    if (col === 9) {
                        if (order.status === 'completed') {
                            cell.font = { color: { argb: 'FF4CAF50' }, bold: true };
                        } else if (order.status === 'voided') {
                            cell.font = { color: { argb: 'FFF44336' }, bold: true };
                        } else {
                            cell.font = { color: { argb: 'FFFF9800' }, bold: true };
                        }
                    }
                }
                
                row.height = 20;
            });

            // Set column widths
            worksheet.columns = [
                { width: 16 }, // Order #
                { width: 22 }, // Date/Time
                { width: 10 }, // Beeper
                { width: 12 }, // Order Type
                { width: 8 },  // Items
                { width: 14 }, // Subtotal
                { width: 12 }, // Discount
                { width: 14 }, // Total
                { width: 12 }  // Status
            ];

        } else if (type === 'sales') {
            // ============ SALES REPORT ============
            const worksheet = workbook.addWorksheet('Sales Report');
            filename = `Sales_Report_${startDate}_to_${endDate}.xlsx`;

            // Build query conditions - exclude voided
            let whereConditions = ["t.status != 'voided'"];
            const params = [];

            if (startDate && endDate) {
                whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }

            if (cashierUserId) {
                whereConditions.push('t.processed_by = ?');
                params.push(cashierUserId);
            }

            // Get daily sales breakdown
            const [salesDetails] = await db.query(`
                SELECT 
                    DATE(t.created_at) as date,
                    COUNT(t.transaction_id) as transaction_count,
                    SUM(t.subtotal) as gross_sales,
                    SUM(COALESCE(t.discount_amount, 0)) as total_discounts,
                    SUM(t.total_amount) as net_sales,
                    AVG(t.total_amount) as avg_order_value
                FROM transactions t
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY DATE(t.created_at)
                ORDER BY DATE(t.created_at) DESC
            `, params);

            // Calculate totals
            const totalTransactions = salesDetails.reduce((sum, d) => sum + parseInt(d.transaction_count), 0);
            const totalGrossSales = salesDetails.reduce((sum, d) => sum + parseFloat(d.gross_sales || 0), 0);
            const totalDiscounts = salesDetails.reduce((sum, d) => sum + parseFloat(d.total_discounts || 0), 0);
            const totalNetSales = salesDetails.reduce((sum, d) => sum + parseFloat(d.net_sales || 0), 0);
            const avgOrderValue = totalTransactions > 0 ? totalNetSales / totalTransactions : 0;

            // Title
            worksheet.mergeCells('A1:F1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'SALES REPORT';
            titleCell.font = { bold: true, size: 16, color: { argb: 'FF6B4423' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 28;

            // Date Range
            worksheet.mergeCells('A2:F2');
            const dateRangeCell = worksheet.getCell('A2');
            dateRangeCell.value = `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`;
            dateRangeCell.font = { size: 11, color: { argb: 'FF666666' } };
            dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(2).height = 20;

            // Note about voided
            worksheet.mergeCells('A3:F3');
            const noteCell = worksheet.getCell('A3');
            noteCell.value = '* Voided orders are excluded from this report';
            noteCell.font = { size: 10, italic: true, color: { argb: 'FF999999' } };
            noteCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Summary Section
            worksheet.getCell('A5').value = 'SUMMARY';
            worksheet.getCell('A5').font = { bold: true, size: 12 };

            const summaryData = [
                ['Total Transactions:', totalTransactions],
                ['Gross Sales:', `₱${formatCurrency(totalGrossSales)}`],
                ['Total Discounts:', `₱${formatCurrency(totalDiscounts)}`],
                ['Net Sales:', `₱${formatCurrency(totalNetSales)}`],
                ['Average Order Value:', `₱${formatCurrency(avgOrderValue)}`]
            ];

            let summaryRow = 6;
            summaryData.forEach(([label, value]) => {
                worksheet.getCell(`A${summaryRow}`).value = label;
                worksheet.getCell(`A${summaryRow}`).style = summaryLabelStyle;
                worksheet.getCell(`B${summaryRow}`).value = value;
                worksheet.getCell(`B${summaryRow}`).style = summaryValueStyle;
                summaryRow++;
            });

            // Empty row before data
            const dataStartRow = summaryRow + 1;

            // Headers
            const headers = ['Date', 'Transactions', 'Gross Sales', 'Discounts', 'Net Sales', 'Avg Order'];
            headers.forEach((header, index) => {
                const cell = worksheet.getCell(dataStartRow, index + 1);
                cell.value = header;
                Object.assign(cell, headerStyle);
            });
            worksheet.getRow(dataStartRow).height = 22;

            // Data rows
            salesDetails.forEach((day, index) => {
                const rowNum = dataStartRow + 1 + index;
                const row = worksheet.getRow(rowNum);
                
                row.getCell(1).value = formatDate(day.date);
                row.getCell(2).value = day.transaction_count;
                row.getCell(3).value = `₱${formatCurrency(day.gross_sales)}`;
                row.getCell(4).value = `₱${formatCurrency(day.total_discounts)}`;
                row.getCell(5).value = `₱${formatCurrency(day.net_sales)}`;
                row.getCell(6).value = `₱${formatCurrency(day.avg_order_value)}`;

                for (let col = 1; col <= 6; col++) {
                    const cell = row.getCell(col);
                    cell.border = cellBorder;
                    cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle' };
                }
                
                row.height = 20;
            });

            // Totals row
            const totalsRowNum = dataStartRow + 1 + salesDetails.length;
            const totalsRow = worksheet.getRow(totalsRowNum);
            totalsRow.getCell(1).value = 'TOTAL';
            totalsRow.getCell(2).value = totalTransactions;
            totalsRow.getCell(3).value = `₱${formatCurrency(totalGrossSales)}`;
            totalsRow.getCell(4).value = `₱${formatCurrency(totalDiscounts)}`;
            totalsRow.getCell(5).value = `₱${formatCurrency(totalNetSales)}`;
            totalsRow.getCell(6).value = `₱${formatCurrency(avgOrderValue)}`;

            for (let col = 1; col <= 6; col++) {
                const cell = totalsRow.getCell(col);
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0E8' } };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF6B4423' } },
                    bottom: { style: 'medium', color: { argb: 'FF6B4423' } },
                    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                };
                cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle' };
            }
            totalsRow.height = 22;

            // Set column widths
            worksheet.columns = [
                { width: 14 }, // Date
                { width: 14 }, // Transactions
                { width: 16 }, // Gross Sales
                { width: 14 }, // Discounts
                { width: 16 }, // Net Sales
                { width: 14 }  // Avg Order
            ];

        } else if (type === 'library') {
            // ============ LIBRARY REPORT ============
            const worksheet = workbook.addWorksheet('Library Report');
            filename = `Library_Report_${startDate}_to_${endDate}.xlsx`;

            // Build query conditions
            let whereConditions = ['1=1'];
            const params = [];

            if (startDate && endDate) {
                whereConditions.push('DATE(ls.start_time) BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }
            if (status && status !== 'all') {
                whereConditions.push('ls.status = ?');
                params.push(status);
            }

            if (cashierUserId) {
                whereConditions.push(`
                    EXISTS (
                        SELECT 1
                        FROM transactions t
                        WHERE t.library_session_id = ls.session_id
                        AND t.processed_by = ?
                        AND t.status != 'voided'
                    )
                `);
                params.push(cashierUserId);
            }

            // Get sessions
            const [sessions] = await db.query(`
                SELECT 
                    ls.session_id,
                    ls.seat_id,
                    s.seat_number,
                    s.table_number,
                    ls.customer_name,
                    ls.start_time,
                    ls.end_time,
                    ls.paid_minutes,
                    ls.total_minutes,
                    ls.amount_paid,
                    ls.amount_due,
                    ls.status
                FROM library_sessions ls
                LEFT JOIN library_seats s ON ls.seat_id = s.seat_id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY ls.start_time DESC
            `, params);

            // Calculate summary
            const totalSessions = sessions.length;
            const completedSessions = sessions.filter(s => s.status === 'completed').length;
            const activeSessions = sessions.filter(s => s.status === 'active').length;
            const totalMinutes = sessions.reduce((sum, s) => sum + parseInt(s.total_minutes || 0), 0);
            const totalHours = (totalMinutes / 60).toFixed(2);
            const totalRevenue = sessions
                .filter(s => s.status === 'completed')
                .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0);

            // Title
            worksheet.mergeCells('A1:I1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'LIBRARY REPORT';
            titleCell.font = { bold: true, size: 16, color: { argb: 'FF6B4423' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 28;

            // Date Range
            worksheet.mergeCells('A2:I2');
            const dateRangeCell = worksheet.getCell('A2');
            dateRangeCell.value = `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`;
            dateRangeCell.font = { size: 11, color: { argb: 'FF666666' } };
            dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(2).height = 20;

            // Summary Section
            worksheet.getCell('A4').value = 'SUMMARY';
            worksheet.getCell('A4').font = { bold: true, size: 12 };

            const summaryData = [
                ['Total Sessions:', totalSessions],
                ['Completed Sessions:', completedSessions],
                ['Active Sessions:', activeSessions],
                ['Total Hours:', `${totalHours} hrs`],
                ['Total Revenue:', `₱${formatCurrency(totalRevenue)}`]
            ];

            let summaryRow = 5;
            summaryData.forEach(([label, value]) => {
                worksheet.getCell(`A${summaryRow}`).value = label;
                worksheet.getCell(`A${summaryRow}`).style = summaryLabelStyle;
                worksheet.getCell(`B${summaryRow}`).value = value;
                worksheet.getCell(`B${summaryRow}`).style = summaryValueStyle;
                summaryRow++;
            });

            // Empty row before data
            const dataStartRow = summaryRow + 1;

            // Headers
            const headers = ['Session #', 'Date', 'Table', 'Seat', 'Customer Name', 'Start Time', 'End Time', 'Duration', 'Amount', 'Status'];
            headers.forEach((header, index) => {
                const cell = worksheet.getCell(dataStartRow, index + 1);
                cell.value = header;
                Object.assign(cell, headerStyle);
            });
            worksheet.getRow(dataStartRow).height = 22;

            // Data rows
            sessions.forEach((session, index) => {
                const rowNum = dataStartRow + 1 + index;
                const row = worksheet.getRow(rowNum);
                
                const sessionId = `LIB-${String(session.session_id).padStart(6, '0')}`;
                const durationMins = session.total_minutes || 0;
                const hours = Math.floor(durationMins / 60);
                const mins = durationMins % 60;
                const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                row.getCell(1).value = sessionId;
                row.getCell(2).value = formatDate(session.start_time);
                row.getCell(3).value = session.table_number || '-';
                row.getCell(4).value = session.seat_number || '-';
                row.getCell(5).value = session.customer_name || '-';
                row.getCell(6).value = formatDateTime(session.start_time);
                row.getCell(7).value = session.end_time ? formatDateTime(session.end_time) : '-';
                row.getCell(8).value = durationStr;
                row.getCell(9).value = `₱${formatCurrency(session.amount_paid || session.amount_due)}`;
                row.getCell(10).value = session.status ? session.status.charAt(0).toUpperCase() + session.status.slice(1) : '-';

                for (let col = 1; col <= 10; col++) {
                    const cell = row.getCell(col);
                    cell.border = cellBorder;
                    cell.alignment = { horizontal: col === 5 ? 'left' : 'center', vertical: 'middle' };
                    
                    // Style status cell
                    if (col === 10) {
                        if (session.status === 'completed') {
                            cell.font = { color: { argb: 'FF4CAF50' }, bold: true };
                        } else if (session.status === 'active') {
                            cell.font = { color: { argb: 'FF2196F3' }, bold: true };
                        } else {
                            cell.font = { color: { argb: 'FFFF9800' }, bold: true };
                        }
                    }
                }
                
                row.height = 20;
            });

            // Set column widths
            worksheet.columns = [
                { width: 14 }, // Session #
                { width: 12 }, // Date
                { width: 8 },  // Table
                { width: 8 },  // Seat
                { width: 20 }, // Customer Name
                { width: 20 }, // Start Time
                { width: 20 }, // End Time
                { width: 12 }, // Duration
                { width: 12 }, // Amount
                { width: 12 }  // Status
            ];
        } else if (type === 'audit') {
            // ============ AUDIT TRAIL REPORT ============
            const worksheet = workbook.addWorksheet('Audit Trail');
            filename = `Audit_Trail_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`;

            const { whereClause, params } = buildAuditLogsWhereClause({
                startDate,
                endDate,
                action,
                actorUserId,
                targetType,
                search
            });

            const [logs] = await db.query(`
                SELECT
                    a.audit_id,
                    a.action,
                    a.actor_user_id,
                    a.target_type,
                    a.target_id,
                    a.details_json,
                    a.ip_address,
                    a.created_at,
                    u.full_name as actor_full_name,
                    u.username as actor_username
                FROM audit_logs a
                LEFT JOIN users u ON a.actor_user_id = u.user_id
                WHERE ${whereClause}
                ORDER BY a.created_at DESC
                LIMIT 5000
            `, params);

            const totalEvents = logs.length;
            const uniqueActors = new Set(logs.map((log) => log.actor_user_id).filter(Boolean)).size;
            const forceClosures = logs.filter((log) => log.action === 'shift_force_closed').length;

            // Title
            worksheet.mergeCells('A1:G1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'AUDIT TRAIL REPORT';
            titleCell.font = { bold: true, size: 16, color: { argb: 'FF6B4423' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 28;

            // Date range
            worksheet.mergeCells('A2:G2');
            const dateRangeCell = worksheet.getCell('A2');
            dateRangeCell.value = `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`;
            dateRangeCell.font = { size: 11, color: { argb: 'FF666666' } };
            dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(2).height = 20;

            worksheet.getCell('A4').value = 'SUMMARY';
            worksheet.getCell('A4').font = { bold: true, size: 12 };

            const summaryData = [
                ['Total Events:', totalEvents],
                ['Unique Actors:', uniqueActors],
                ['Shift Force Closures:', forceClosures],
                ['Action Filter:', action || 'All'],
                ['Target Filter:', targetType || 'All']
            ];

            let summaryRow = 5;
            summaryData.forEach(([label, value]) => {
                worksheet.getCell(`A${summaryRow}`).value = label;
                worksheet.getCell(`A${summaryRow}`).style = summaryLabelStyle;
                worksheet.getCell(`B${summaryRow}`).value = value;
                worksheet.getCell(`B${summaryRow}`).style = summaryValueStyle;
                summaryRow++;
            });

            const dataStartRow = summaryRow + 1;
            const headers = ['Date/Time', 'Action', 'Actor', 'Target', 'Details', 'IP Address', 'Audit ID'];

            headers.forEach((header, index) => {
                const cell = worksheet.getCell(dataStartRow, index + 1);
                cell.value = header;
                Object.assign(cell, headerStyle);
            });

            worksheet.getRow(dataStartRow).height = 22;

            logs.forEach((log, index) => {
                const rowNum = dataStartRow + 1 + index;
                const row = worksheet.getRow(rowNum);

                const actorName = log.actor_full_name || 'System';
                const actorUsername = log.actor_username ? ` (@${log.actor_username})` : '';
                const targetLabel = log.target_type
                    ? `${log.target_type}${log.target_id != null ? ` #${log.target_id}` : ''}`
                    : '-';

                row.getCell(1).value = formatDateTime(log.created_at);
                row.getCell(2).value = formatAuditActionLabel(log.action);
                row.getCell(3).value = `${actorName}${actorUsername}`;
                row.getCell(4).value = targetLabel;
                row.getCell(5).value = stringifyAuditDetails(log.details_json);
                row.getCell(6).value = log.ip_address || '-';
                row.getCell(7).value = log.audit_id;

                for (let col = 1; col <= 7; col++) {
                    const cell = row.getCell(col);
                    cell.border = cellBorder;
                    cell.alignment = { horizontal: col === 5 ? 'left' : 'center', vertical: 'middle', wrapText: col === 5 };

                    if (col === 2) {
                        cell.font = { bold: true, color: { argb: 'FF1565C0' } };
                    }
                }

                row.height = 24;
            });

            worksheet.columns = [
                { width: 22 }, // Date/Time
                { width: 22 }, // Action
                { width: 22 }, // Actor
                { width: 18 }, // Target
                { width: 46 }, // Details
                { width: 18 }, // IP
                { width: 10 }  // Audit ID
            ];
        }

        // Generate the Excel file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: error.message });
    }
};


// EXPORT TO PDF

exports.exportPDF = async (req, res) => {
    const { type, startDate, endDate, orderType, status, action, actorUserId, targetType, search, cashierUserId } = req.query;

    try {
        // Create PDF document
        const doc = new PDFDocument({ 
            margin: 40,
            size: 'A4',
            layout: 'landscape'
        });

        let filename = '';

        // Helper function to format currency
        const formatCurrency = (amount) => {
            return `P${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        // Helper function to format date
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-PH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        };

        // Helper function to format datetime
        const formatDateTime = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleString('en-PH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Draw table header
        const drawTableHeader = (headers, y, columnWidths) => {
            doc.font('Helvetica-Bold').fontSize(9);
            let x = 40;
            
            // Header background
            doc.fillColor('#6b4423').rect(40, y - 5, 760, 20).fill();
            doc.fillColor('white');
            
            headers.forEach((header, i) => {
                doc.text(header, x + 5, y, { width: columnWidths[i] - 10, align: 'left' });
                x += columnWidths[i];
            });
            
            doc.fillColor('black');
            return y + 20;
        };

        // Draw table row
        const drawTableRow = (data, y, columnWidths, isAlternate = false) => {
            doc.font('Helvetica').fontSize(8);
            let x = 40;
            
            // Alternate row background
            if (isAlternate) {
                doc.fillColor('#f5f5f5').rect(40, y - 3, 760, 18).fill();
                doc.fillColor('black');
            }
            
            data.forEach((cell, i) => {
                doc.text(String(cell || '-'), x + 5, y, { width: columnWidths[i] - 10, align: 'left' });
                x += columnWidths[i];
            });
            
            return y + 18;
        };

        // Add page header
        const addPageHeader = (title, subtitle) => {
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#3e2723');
            doc.text('LIBRARY COFFEE + STUDY', 40, 40);
            doc.font('Helvetica').fontSize(12).fillColor('#666');
            doc.text(title, 40, 62);
            doc.fontSize(10).fillColor('#888');
            doc.text(subtitle, 40, 78);
            doc.moveDown(2);
            return 100;
        };

        // Check if we need a new page
        const checkNewPage = (y, minHeight = 100) => {
            if (y > 520) {
                doc.addPage();
                return 40;
            }
            return y;
        };

        if (type === 'orders') {
            // ORDERS REPORT PDF
            filename = `Orders_Report_${startDate}_to_${endDate}.pdf`;
            
            let whereConditions = ["t.status != 'voided'"];
            const params = [];

            if (startDate && endDate) {
                whereConditions.push('DATE(t.created_at) BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }

            if (orderType) {
                whereConditions.push('t.order_type = ?');
                params.push(orderType);
            }

            if (status) {
                whereConditions.push('t.status = ?');
                params.push(status);
            }

            if (cashierUserId) {
                whereConditions.push('t.processed_by = ?');
                params.push(cashierUserId);
            }

            const [orders] = await db.query(`
                SELECT 
                    t.transaction_id,
                    t.beeper_number,
                    t.order_type,
                    t.subtotal,
                    t.discount_amount,
                    t.total_amount,
                    t.status,
                    t.created_at,
                    u.full_name as cashier_name,
                    (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.transaction_id) as item_count
                FROM transactions t
                LEFT JOIN users u ON t.processed_by = u.user_id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY t.created_at DESC
            `, params);

            // Calculate summary
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Page header
            let y = addPageHeader('Orders Report', `Date Range: ${startDate} to ${endDate}`);

            // Summary section
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#3e2723');
            doc.text('Summary', 40, y);
            y += 18;
            doc.font('Helvetica').fontSize(10).fillColor('black');
            doc.text(`Total Orders: ${totalOrders}    |    Total Revenue: ${formatCurrency(totalRevenue)}    |    Average Order Value: ${formatCurrency(avgOrderValue)}`, 40, y);
            y += 30;

            // Table
            const headers = ['Order #', 'Date/Time', 'Beeper', 'Type', 'Items', 'Subtotal', 'Discount', 'Total', 'Status'];
            const columnWidths = [85, 120, 60, 70, 50, 80, 70, 80, 75];
            
            y = drawTableHeader(headers, y, columnWidths);

            orders.forEach((order, index) => {
                y = checkNewPage(y);
                const rowData = [
                    `ORD-${String(order.transaction_id).padStart(6, '0')}`,
                    formatDateTime(order.created_at),
                    order.beeper_number || '-',
                    order.order_type || '-',
                    order.item_count,
                    formatCurrency(order.subtotal),
                    order.discount_amount > 0 ? formatCurrency(order.discount_amount) : '-',
                    formatCurrency(order.total_amount),
                    order.status
                ];
                y = drawTableRow(rowData, y, columnWidths, index % 2 === 1);
            });

        } else if (type === 'sales') {
            // SALES REPORT PDF
            filename = `Sales_Report_${startDate}_to_${endDate}.pdf`;

            const [dailySales] = await db.query(`
                SELECT 
                    DATE(t.created_at) as sale_date,
                    COUNT(DISTINCT t.transaction_id) as order_count,
                    SUM(t.total_amount) as total_sales,
                    SUM(t.discount_amount) as total_discounts
                FROM transactions t
                WHERE t.status != 'voided'
                AND DATE(t.created_at) BETWEEN ? AND ?
                ${cashierUserId ? 'AND t.processed_by = ?' : ''}
                GROUP BY DATE(t.created_at)
                ORDER BY DATE(t.created_at) DESC
            `, cashierUserId ? [startDate, endDate, cashierUserId] : [startDate, endDate]);

            // Calculate totals
            const totalOrders = dailySales.reduce((sum, d) => sum + d.order_count, 0);
            const totalSales = dailySales.reduce((sum, d) => sum + parseFloat(d.total_sales || 0), 0);
            const totalDiscounts = dailySales.reduce((sum, d) => sum + parseFloat(d.total_discounts || 0), 0);

            // Page header
            let y = addPageHeader('Sales Report', `Date Range: ${startDate} to ${endDate}`);

            // Summary section
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#3e2723');
            doc.text('Summary', 40, y);
            y += 18;
            doc.font('Helvetica').fontSize(10).fillColor('black');
            doc.text(`Total Orders: ${totalOrders}    |    Total Sales: ${formatCurrency(totalSales)}    |    Total Discounts: ${formatCurrency(totalDiscounts)}`, 40, y);
            y += 30;

            // Table
            const headers = ['Date', 'Orders', 'Total Sales', 'Discounts', 'Net Sales'];
            const columnWidths = [150, 120, 150, 150, 150];
            
            y = drawTableHeader(headers, y, columnWidths);

            dailySales.forEach((day, index) => {
                y = checkNewPage(y);
                const netSales = parseFloat(day.total_sales || 0) - parseFloat(day.total_discounts || 0);
                const rowData = [
                    formatDate(day.sale_date),
                    day.order_count,
                    formatCurrency(day.total_sales),
                    formatCurrency(day.total_discounts),
                    formatCurrency(netSales)
                ];
                y = drawTableRow(rowData, y, columnWidths, index % 2 === 1);
            });

        } else if (type === 'library') {
            // LIBRARY REPORT PDF
            filename = `Library_Report_${startDate}_to_${endDate}.pdf`;

            let whereConditions = ['1=1'];
            const params = [startDate, endDate];

            if (status) {
                whereConditions.push('ls.status = ?');
                params.push(status);
            }

            if (cashierUserId) {
                whereConditions.push(`
                    EXISTS (
                        SELECT 1
                        FROM transactions t
                        WHERE t.library_session_id = ls.session_id
                        AND t.processed_by = ?
                        AND t.status != 'voided'
                    )
                `);
                params.push(cashierUserId);
            }

            const [sessions] = await db.query(`
                SELECT 
                    ls.session_id,
                    ls.customer_name,
                    ls.check_in_time,
                    ls.check_out_time,
                    ls.duration_hours,
                    ls.fee,
                    ls.status,
                    lt.table_name,
                    ls.seat_number
                FROM library_sessions ls
                LEFT JOIN library_tables lt ON ls.table_id = lt.table_id
                WHERE DATE(ls.check_in_time) BETWEEN ? AND ?
                AND ${whereConditions.join(' AND ')}
                ORDER BY ls.check_in_time DESC
            `, params);

            // Calculate summary
            const totalSessions = sessions.length;
            const totalRevenue = sessions.reduce((sum, s) => sum + parseFloat(s.fee || 0), 0);
            const totalHours = sessions.reduce((sum, s) => sum + parseFloat(s.duration_hours || 0), 0);

            // Page header
            let y = addPageHeader('Library Report', `Date Range: ${startDate} to ${endDate}`);

            // Summary section
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#3e2723');
            doc.text('Summary', 40, y);
            y += 18;
            doc.font('Helvetica').fontSize(10).fillColor('black');
            doc.text(`Total Sessions: ${totalSessions}    |    Total Revenue: ${formatCurrency(totalRevenue)}    |    Total Hours: ${totalHours.toFixed(1)}`, 40, y);
            y += 30;

            // Table
            const headers = ['Session #', 'Customer', 'Table/Seat', 'Check In', 'Check Out', 'Duration', 'Fee', 'Status'];
            const columnWidths = [80, 120, 80, 110, 110, 70, 80, 70];
            
            y = drawTableHeader(headers, y, columnWidths);

            sessions.forEach((session, index) => {
                y = checkNewPage(y);
                const rowData = [
                    `SES-${String(session.session_id).padStart(6, '0')}`,
                    session.customer_name || '-',
                    session.table_name ? `${session.table_name} / Seat ${session.seat_number}` : '-',
                    formatDateTime(session.check_in_time),
                    session.check_out_time ? formatDateTime(session.check_out_time) : '-',
                    session.duration_hours ? `${parseFloat(session.duration_hours).toFixed(1)} hrs` : '-',
                    formatCurrency(session.fee),
                    session.status
                ];
                y = drawTableRow(rowData, y, columnWidths, index % 2 === 1);
            });
        } else if (type === 'audit') {
            // AUDIT TRAIL REPORT PDF
            filename = `Audit_Trail_${startDate || 'all'}_to_${endDate || 'all'}.pdf`;

            const { whereClause, params } = buildAuditLogsWhereClause({
                startDate,
                endDate,
                action,
                actorUserId,
                targetType,
                search
            });

            const [logs] = await db.query(`
                SELECT
                    a.audit_id,
                    a.action,
                    a.actor_user_id,
                    a.target_type,
                    a.target_id,
                    a.details_json,
                    a.ip_address,
                    a.created_at,
                    u.full_name as actor_full_name,
                    u.username as actor_username
                FROM audit_logs a
                LEFT JOIN users u ON a.actor_user_id = u.user_id
                WHERE ${whereClause}
                ORDER BY a.created_at DESC
                LIMIT 1200
            `, params);

            const totalEvents = logs.length;
            const forceClosures = logs.filter((log) => log.action === 'shift_force_closed').length;
            const uniqueActors = new Set(logs.map((log) => log.actor_user_id).filter(Boolean)).size;

            let y = addPageHeader('Audit Trail Report', `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

            doc.font('Helvetica-Bold').fontSize(11).fillColor('#3e2723');
            doc.text('Summary', 40, y);
            y += 18;
            doc.font('Helvetica').fontSize(10).fillColor('black');
            doc.text(
                `Total Events: ${totalEvents}    |    Unique Actors: ${uniqueActors}    |    Force Closures: ${forceClosures}`,
                40,
                y
            );
            y += 30;

            const headers = ['Date/Time', 'Action', 'Actor', 'Target', 'IP', 'Details'];
            const columnWidths = [120, 100, 120, 90, 80, 250];

            y = drawTableHeader(headers, y, columnWidths);

            logs.forEach((log, index) => {
                if (y > 520) {
                    doc.addPage();
                    y = addPageHeader('Audit Trail Report (cont.)', `Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
                    y = drawTableHeader(headers, y, columnWidths);
                }

                const actorName = log.actor_full_name || 'System';
                const actorUsername = log.actor_username ? ` @${log.actor_username}` : '';
                const targetLabel = log.target_type
                    ? `${log.target_type}${log.target_id != null ? ` #${log.target_id}` : ''}`
                    : '-';

                const detailsText = stringifyAuditDetails(log.details_json);
                const limitedDetails = detailsText.length > 120 ? `${detailsText.slice(0, 117)}...` : detailsText;

                const rowData = [
                    formatDateTime(log.created_at),
                    formatAuditActionLabel(log.action),
                    `${actorName}${actorUsername}`,
                    targetLabel,
                    log.ip_address || '-',
                    limitedDetails
                ];

                y = drawTableRow(rowData, y, columnWidths, index % 2 === 1);
            });
        }

        // Add footer with generation date
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.font('Helvetica').fontSize(8).fillColor('#888');
            doc.text(
                `Generated on ${new Date().toLocaleString('en-PH')} | Page ${i + 1} of ${pages.count}`,
                40, 545,
                { align: 'center', width: 760 }
            );
        }

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Pipe PDF to response
        doc.pipe(res);
        doc.end();

    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ error: error.message });
    }
};