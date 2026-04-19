/**
 * Thermal Printer Service for JK-5802H (58mm)
 * Interface: USB (via WinUSB driver)
 * 
 * This service handles receipt printing for:
 * - Customer receipts
 * - Barista tickets
 * - Kitchen tickets
 * - Library session receipts
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load USB package for direct printing
let usb;
let useDirectUSB = false;

try {
    usb = require('usb');
    useDirectUSB = true;
    console.log('✅ USB module loaded - Direct USB printing available');
} catch (e) {
    console.log('⚠️ USB module not available, falling back to Windows printing');
}

// USB Printer IDs (JK-5802H)
const USB_VENDOR_ID = 0x0483;
const USB_PRODUCT_ID = 0x5743;

// Printer configuration
const PRINTER_CONFIG = {
    name: 'JK-5802H',
    width: 32,  // Characters per line for 58mm paper
    encoding: 'cp437',
    // Windows printer name (update this after installing printer)
    windowsPrinterName: process.env.PRINTER_NAME || 'POS-58',
};

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
    INIT: ESC + '@',                    // Initialize printer
    ALIGN_LEFT: ESC + 'a' + '\x00',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_RIGHT: ESC + 'a' + '\x02',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    DOUBLE_HEIGHT: GS + '!' + '\x10',
    DOUBLE_WIDTH: GS + '!' + '\x20',
    DOUBLE_SIZE: GS + '!' + '\x30',
    NORMAL_SIZE: GS + '!' + '\x00',
    UNDERLINE_ON: ESC + '-' + '\x01',
    UNDERLINE_OFF: ESC + '-' + '\x00',
    CUT_PAPER: GS + 'V' + '\x00',       // Full cut
    PARTIAL_CUT: GS + 'V' + '\x01',     // Partial cut
    FEED_LINES: (n) => ESC + 'd' + String.fromCharCode(n),
};

/**
 * Generate a separator line
 */
function separator(char = '-') {
    return char.repeat(PRINTER_CONFIG.width);
}

/**
 * Center text within printer width
 */
function centerText(text) {
    const padding = Math.floor((PRINTER_CONFIG.width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return `${parseFloat(amount || 0).toFixed(2)}`;
}

/**
 * Format date/time
 */
function formatDateTime(date = new Date()) {
    return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function getFirstName(name) {
    if (!name) return '';
    return String(name).trim().split(/\s+/)[0] || '';
}

/**
 * Helper to get size abbreviation
 */
function getSizeAbbrev(sizeName) {
    if (!sizeName) return '';
    const lower = sizeName.toLowerCase();
    if (lower.includes('large')) return '(L)';
    if (lower.includes('medium')) return '(M)';
    if (lower.includes('small')) return '(S)';
    return '';
}

/**
 * Helper to format customizations for display
 */
function formatCustomizations(customizations) {
    if (!customizations || customizations.length === 0) return null;
    
    let size = '';
    let temp = '';
    const addons = [];
    
    customizations.forEach(c => {
        const groupName = (c.group_name || '').toLowerCase();
        const optionName = c.option_name || c.name || '';
        
        if (groupName.includes('size')) {
            size = optionName;
        } else if (groupName.includes('temp') || groupName.includes('temperature')) {
            temp = optionName;
        } else {
            // It's an add-on
            const qty = c.quantity || 1;
            const price = parseFloat(c.total_price || c.unit_price || 0);
            addons.push({
                name: optionName,
                quantity: qty,
                price: price
            });
        }
    });
    
    return { size, temp, addons };
}


 // Build Customer Receipt

function buildCustomerReceipt(order, copyLabel = 'CUSTOMER RECEIPT') {
    let receipt = '';
    const cashierFirstName = getFirstName(order.cashier_name);
    
    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold for 58mm paper
    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Coffee + Study\n';
    receipt += 'Pavilion, Nunez St.\n';
    receipt += 'Zamboanga City\n';
    receipt += separator() + '\n';
    
    // Pad transaction number with leading zeros (6 digits) and add ORD prefix
    const transactionNum = 'ORD-' + String(order.transaction_id || order.order_id || order.id).padStart(6, '0');
    
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += `${copyLabel}\n`;
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime()}\n`;
    receipt += `Order #: ${transactionNum}\n`;
    receipt += `Beeper #: ${order.beeper_number}\n`;
    if (cashierFirstName) {
        receipt += `Cashier: ${cashierFirstName}\n`;
    }
    receipt += separator() + '\n';
    
    // Items with customizations
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += 'ITEMS:\n';
    receipt += COMMANDS.ALIGN_LEFT;
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemName = item.name || item.item_name;
            const qty = item.quantity;
            const basePrice = parseFloat(item.price || item.unit_price);
            
            // Parse customizations
            const customs = formatCustomizations(item.customizations);
            
            // Build item line with size
            let itemLine = `${qty}x ${itemName}`;
            if (customs && customs.size) {
                itemLine += ` ${getSizeAbbrev(customs.size)}`;
            }
            receipt += itemLine + '\n';
            
            // Show temperature if specified
            if (customs && customs.temp) {
                receipt += `   [${customs.temp}]\n`;
            }
            
            // Show add-ons
            if (customs && customs.addons.length > 0) {
                customs.addons.forEach(addon => {
                    const addonQty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
                    receipt += `   + ${addonQty}${addon.name}`;
                    if (addon.price > 0) {
                        receipt += ` (+${formatCurrency(addon.price)})`;
                    }
                    receipt += '\n';
                });
            }
            
            // Calculate item total (base + customizations)
            let itemTotal = basePrice * qty;
            if (customs && customs.addons.length > 0) {
                customs.addons.forEach(addon => {
                    itemTotal += addon.price;
                });
            }
            
            receipt += `   @ ${formatCurrency(basePrice)} = ${formatCurrency(itemTotal)}\n`;
        });
    }
    
    receipt += separator() + '\n';
    
    // Totals
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `Subtotal: ${formatCurrency(order.subtotal ?? order.total_amount)}\n`;
    
    if (order.discount_amount && parseFloat(order.discount_amount) > 0) {
        const dLabel = order.discount_name ? `Discount (${order.discount_name})` : 'Discount';
        receipt += `${dLabel}: -${formatCurrency(order.discount_amount)}\n`;
    }

    receipt += COMMANDS.ALIGN_CENTER;
    receipt += 'TAX BREAKDOWN\n';
    receipt += COMMANDS.ALIGN_RIGHT;
    const netVatable =
        order.net_vatable_sales != null && order.net_vatable_sales !== undefined
            ? parseFloat(order.net_vatable_sales)
            : Math.max(
                  0,
                  parseFloat(order.vatable_sales || 0) - parseFloat(order.vat_amount || 0)
              );
    receipt += `VATable (V): ${formatCurrency(netVatable)}\n`;
    receipt += `Non-VATable: ${formatCurrency(order.non_vatable_sales || 0)}\n`;
    receipt += `VAT: ${formatCurrency(order.vat_amount || 0)}\n`;
    
    // Library Booking (if exists)
    let libraryBooking = null;
    if (order.library_booking) {
        try {
            libraryBooking = typeof order.library_booking === 'string' 
                ? JSON.parse(order.library_booking) 
                : order.library_booking;
        } catch (e) {
            // Ignore parsing errors
        }
    }
    
    if (libraryBooking) {
        receipt += COMMANDS.ALIGN_LEFT;
        receipt += separator() + '\n';
        receipt += COMMANDS.BOLD_ON;
        receipt += 'STUDY AREA BOOKING:\n';
        receipt += COMMANDS.BOLD_OFF;
        receipt += `Table ${libraryBooking.table_number}, Seat ${libraryBooking.seat_number}\n`;
        const durationHours = Math.floor(libraryBooking.duration_minutes / 60);
        const durationMins = libraryBooking.duration_minutes % 60;
        let durationStr = `${durationHours}h`;
        if (durationMins > 0) durationStr += ` ${durationMins}m`;
        receipt += `Duration: ${durationStr}\n`;
        receipt += COMMANDS.ALIGN_RIGHT;
        receipt += `Study Area: ${formatCurrency(libraryBooking.amount)}\n`;
    }
    
    receipt += COMMANDS.BOLD_ON;
    receipt += `TOTAL: ${formatCurrency(order.final_amount || order.total_amount)}\n`;
    receipt += COMMANDS.BOLD_OFF;
    
    if (order.cash_tendered) {
        receipt += `Cash: ${formatCurrency(order.cash_tendered)}\n`;
        receipt += `Change: ${formatCurrency(order.change_due || 0)}\n`;
    }
    
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += separator() + '\n';
    receipt += 'Thank you for visiting!\n';
    receipt += 'Please wait for your order\n';
    receipt += 'number to be called.\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += '\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';
    
    // Barista copy section
    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;
    
    return receipt;
}


 // Build Barista Ticket

function buildBaristaTicket(order) {
    let ticket = '';
    const cashierFirstName = getFirstName(order.cashier_name);
    
    ticket += COMMANDS.INIT;
    ticket += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold
    ticket += COMMANDS.BOLD_ON;
    ticket += '*** BARISTA ***\n';
    ticket += COMMANDS.BOLD_OFF;
    ticket += separator() + '\n';
    
    // Order number - normal size with bold for better fit on 58mm
    ticket += COMMANDS.BOLD_ON;
    ticket += `BEEPER #${order.beeper_number}\n`;
    ticket += COMMANDS.BOLD_OFF;
    
    ticket += `Time: ${formatDateTime()}\n`;
    if (cashierFirstName) {
        ticket += `Cashier: ${cashierFirstName}\n`;
    }
    ticket += separator() + '\n';
    
    // Filter barista items only
    const baristaItems = order.items?.filter(item => 
        item.station === 'barista' || !item.station
    ) || order.items || [];
    
    if (baristaItems.length > 0) {
        ticket += COMMANDS.ALIGN_LEFT;
        baristaItems.forEach(item => {
            const itemName = item.name || item.item_name;
            
            // Parse customizations for size, temp, and add-ons
            const customs = formatCustomizations(item.customizations);
            
            // Build item line with size indicator - normal size with bold
            ticket += COMMANDS.BOLD_ON;
            let itemLine = `${item.quantity}x ${itemName}`;
            if (customs && customs.size) {
                itemLine += ` ${getSizeAbbrev(customs.size)}`;
            }
            ticket += itemLine + '\n';
            ticket += COMMANDS.BOLD_OFF;
            
            // Show temperature
            if (customs && customs.temp) {
                ticket += `   >> ${customs.temp.toUpperCase()}\n`;
            }
            
            // Show add-ons prominently
            if (customs && customs.addons.length > 0) {
                customs.addons.forEach(addon => {
                    const addonQty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
                    ticket += `   + ${addonQty}${addon.name}\n`;
                });
            }
            
            ticket += '\n';
        });
    } else {
        ticket += COMMANDS.ALIGN_CENTER;
        ticket += '(No barista items)\n';
    }
    
    // Library Booking notice (if exists)
    let libraryBooking = null;
    if (order.library_booking) {
        try {
            libraryBooking = typeof order.library_booking === 'string' 
                ? JSON.parse(order.library_booking) 
                : order.library_booking;
        } catch (e) {
            // Ignore parsing errors
        }
    }
    
    if (libraryBooking) {
        ticket += separator() + '\n';
        ticket += COMMANDS.BOLD_ON;
        ticket += `STUDY AREA: T${libraryBooking.table_number}-S${libraryBooking.seat_number}\n`;
        ticket += COMMANDS.BOLD_OFF;
    }
    
    ticket += separator() + '\n';
    ticket += COMMANDS.FEED_LINES(1);
    ticket += COMMANDS.PARTIAL_CUT;
    
    return ticket;
}


// Build Kitchen Ticket
 
function buildKitchenTicket(order) {
    let ticket = '';
    const cashierFirstName = getFirstName(order.cashier_name);
    
    ticket += COMMANDS.INIT;
    ticket += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold (matching barista style)
    ticket += COMMANDS.BOLD_ON;
    ticket += '*** KITCHEN ***\n';
    ticket += COMMANDS.BOLD_OFF;
    ticket += separator() + '\n';
    
    // Order number - normal size with bold (matching barista style)
    ticket += COMMANDS.BOLD_ON;
    ticket += `BEEPER #${order.beeper_number}\n`;
    ticket += COMMANDS.BOLD_OFF;
    
    ticket += `Time: ${formatDateTime()}\n`;
    if (cashierFirstName) {
        ticket += `Cashier: ${cashierFirstName}\n`;
    }
    ticket += separator() + '\n';
    
    // Filter kitchen items only
    const kitchenItems = order.items?.filter(item => 
        item.station === 'kitchen'
    ) || [];
    
    if (kitchenItems.length > 0) {
        ticket += COMMANDS.ALIGN_LEFT;
        kitchenItems.forEach(item => {
            const itemName = item.name || item.item_name;
            
            // Parse customizations
            const customs = formatCustomizations(item.customizations);
            
            // Item line - normal size with bold (matching barista style)
            ticket += COMMANDS.BOLD_ON;
            ticket += `${item.quantity}x ${itemName}\n`;
            ticket += COMMANDS.BOLD_OFF;
            
            // Show any special instructions/add-ons
            if (customs && customs.addons.length > 0) {
                customs.addons.forEach(addon => {
                    const addonQty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
                    ticket += `   + ${addonQty}${addon.name}\n`;
                });
            }
            
            ticket += '\n';
        });
    } else {
        ticket += COMMANDS.ALIGN_CENTER;
        ticket += '(No kitchen items)\n';
    }
    
    ticket += separator() + '\n';
    ticket += COMMANDS.FEED_LINES(1);
    ticket += COMMANDS.PARTIAL_CUT;
    
    return ticket;
}


/** VAT lines for study receipts (fields from computeTransactionTaxSnapshot). */
function libraryTaxBreakdownEscPos(session) {
    if (session == null || session.vat_amount === undefined) return '';
    const vat = parseFloat(session.vat_amount ?? 0) || 0;
    const vGross = parseFloat(session.vatable_sales ?? 0) || 0;
    const nonV = parseFloat(session.non_vatable_sales ?? 0) || 0;
    const netV =
        session.net_vatable_sales != null && session.net_vatable_sales !== undefined
            ? parseFloat(session.net_vatable_sales)
            : Math.max(0, vGross - vat);
    let out = '';
    out += 'TAX BREAKDOWN\n';
    out += `VATable (V): ${formatCurrency(netV)}\n`;
    out += `Non-VATable: ${formatCurrency(nonV)}\n`;
    out += `VAT: ${formatCurrency(vat)}\n`;
    out += separator() + '\n';
    return out;
}

// Build Library Check-in Receipt (after initial payment)
function buildLibraryCheckinReceipt(session) {
    let receipt = '';
    const cashierFirstName = getFirstName(session.cashier_name);
    
    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold (consistent with other receipts)
    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Study Space Check-in\n';
    receipt += separator() + '\n';
    
    // Session info
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime()}\n`;
    if (session.session_id) {
        receipt += `Session #: LIB-${String(session.session_id).padStart(6, '0')}\n`;
    }
    receipt += `Table: ${session.table_number}\n`;
    receipt += `Seat: ${session.seat_number}\n`;
    receipt += separator() + '\n';
    
    // Customer Name
    receipt += COMMANDS.BOLD_ON;
    receipt += `Customer: ${session.customer_name}\n`;
    receipt += COMMANDS.BOLD_OFF;
    if (cashierFirstName) {
        receipt += `Cashier: ${cashierFirstName}\n`;
    }
    receipt += separator() + '\n';
    
    // Session details
    receipt += 'SESSION DETAILS:\n';
    receipt += `Start Time: ${formatDateTime()}\n`;
    // Format duration dynamically
    const durationMins = session.paid_minutes || session.duration_minutes || 120;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    let durationStr = `${hours} hour${hours > 1 ? 's' : ''}`;
    if (mins > 0) durationStr += ` ${mins} mins`;
    receipt += `Duration: ${durationStr}\n`;
    receipt += separator() + '\n';
    
    receipt += libraryTaxBreakdownEscPos(session);

    // Payment
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `AMOUNT PAID: ${formatCurrency(session.amount_paid || 100)}\n`;
    receipt += COMMANDS.BOLD_OFF;
    
    if (session.cash_tendered) {
        receipt += `Cash: ${formatCurrency(session.cash_tendered)}\n`;
        receipt += `Change: ${formatCurrency(session.change_due || 0)}\n`;
    }
    
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += separator() + '\n';
    receipt += 'Extension: 50.00 per 30 mins\n';
    receipt += separator() + '\n';
    receipt += 'Thank you!\n';
    receipt += 'Enjoy your study session.\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += '\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';
    
    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;
    
    return receipt;
}


// Build Library Extension Receipt (after extending time)
function buildLibraryExtensionReceipt(session) {
    let receipt = '';
    const cashierFirstName = getFirstName(session.cashier_name);
    
    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold
    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Session Extension\n';
    receipt += separator() + '\n';
    
    // Session info
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime()}\n`;
    if (session.session_id) {
        receipt += `Session #: LIB-${String(session.session_id).padStart(6, '0')}\n`;
    }
    receipt += `Table: ${session.table_number}\n`;
    receipt += `Seat: ${session.seat_number}\n`;
    receipt += `Customer: ${session.customer_name}\n`;
    if (cashierFirstName) {
        receipt += `Cashier: ${cashierFirstName}\n`;
    }
    receipt += separator() + '\n';
    
    // Extension details
    receipt += COMMANDS.BOLD_ON;
    receipt += 'EXTENSION:\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += `Added Time: +${session.added_minutes} minutes\n`;
    receipt += `Extension Fee: ${formatCurrency(session.extension_fee)}\n`;
    receipt += separator() + '\n';
    
    // New totals
    receipt += 'UPDATED SESSION:\n';
    receipt += `Total Time: ${session.new_total_minutes} minutes\n`;
    receipt += `Remaining: ${session.remaining_minutes} minutes\n`;
    receipt += separator() + '\n';
    
    receipt += libraryTaxBreakdownEscPos(session);

    // Payment
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `PAID: ${formatCurrency(session.extension_fee)}\n`;
    receipt += COMMANDS.BOLD_OFF;
    
    if (session.cash_tendered) {
        receipt += `Cash: ${formatCurrency(session.cash_tendered)}\n`;
        receipt += `Change: ${formatCurrency(session.change_due || 0)}\n`;
    }
    
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += separator() + '\n';
    receipt += 'Thank you for extending!\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += '\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';
    
    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;
    
    return receipt;
}


// Build Library Checkout Receipt (session end)
function buildLibraryCheckoutReceipt(session) {
    let receipt = '';
    const cashierFirstName = getFirstName(session.cashier_name);
    const startLabel = session.start_time ? formatDateTime(new Date(session.start_time)) : '-';
    const endLabel = session.end_time ? formatDateTime(new Date(session.end_time)) : formatDateTime();

    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;

    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Session Checkout\n';
    receipt += separator() + '\n';

    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime()}\n`;
    if (session.session_id) {
        receipt += `Session #: LIB-${String(session.session_id).padStart(6, '0')}\n`;
    }
    receipt += `Table: ${session.table_number || '-'}\n`;
    receipt += `Seat: ${session.seat_number || '-'}\n`;
    receipt += `Customer: ${session.customer_name || '-'}\n`;
    if (cashierFirstName) {
        receipt += `Cashier: ${cashierFirstName}\n`;
    }
    receipt += separator() + '\n';

    receipt += COMMANDS.BOLD_ON;
    receipt += 'SESSION SUMMARY:\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += `Start: ${startLabel}\n`;
    receipt += `End: ${endLabel}\n`;
    receipt += `Used Time: ${session.total_minutes || 0} mins\n`;
    receipt += `Paid Time: ${session.paid_minutes || 0} mins\n`;
    receipt += separator() + '\n';

    receipt += libraryTaxBreakdownEscPos(session);

    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `TOTAL PAID: ${formatCurrency(session.amount_paid || 0)}\n`;
    receipt += COMMANDS.BOLD_OFF;

    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += separator() + '\n';
    receipt += 'Thank you for studying with us!\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += '\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';

    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;

    return receipt;
}


// Build Refund Receipt
function buildRefundReceipt(data) {
    let receipt = '';

    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Coffee + Study\n';
    receipt += 'Pavilion, Nunez St.\n';
    receipt += 'Zamboanga City\n';
    receipt += separator() + '\n';

    receipt += COMMANDS.BOLD_ON;
    receipt += '*** REFUND RECEIPT ***\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += separator() + '\n';

    const transactionNum = 'ORD-' + String(data.transaction_id || data.order_id || data.id || 0).padStart(6, '0');
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime(data.refunded_at || new Date())}\n`;
    receipt += `Orig Order: ${transactionNum}\n`;
    receipt += `Beeper #: ${data.beeper_number || '-'}\n`;
    receipt += `Orig Date: ${formatDateTime(data.created_at || new Date())}\n`;
    if (data.refunded_by) {
        receipt += `Auth By: ${getFirstName(data.refunded_by)}\n`;
    }
    receipt += separator() + '\n';

    receipt += 'REFUNDED ITEMS:\n';
    if (Array.isArray(data.items) && data.items.length > 0) {
        data.items.forEach(item => {
            const itemName = item.item_name || item.name || 'Item';
            const qty = Number(item.quantity || 1);
            const totalPrice = Number(item.total_price || (Number(item.unit_price || 0) * qty));
            const left = `${qty}x ${itemName}`;
            const right = formatCurrency(totalPrice);
            const spacing = Math.max(1, PRINTER_CONFIG.width - left.length - right.length);
            receipt += `${left}${' '.repeat(spacing)}${right}\n`;
        });
    }

    receipt += separator() + '\n';
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `Subtotal: ${formatCurrency(data.subtotal || data.total_amount || 0)}\n`;
    if (data.discount_amount && Number(data.discount_amount) > 0) {
        receipt += `Discount: -${formatCurrency(data.discount_amount)}\n`;
    }
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += 'TAX BREAKDOWN (refund portion)\n';
    receipt += COMMANDS.ALIGN_RIGHT;
    const rNet =
        data.net_vatable_sales != null && data.net_vatable_sales !== undefined
            ? Number(data.net_vatable_sales)
            : Math.max(
                  0,
                  Number(data.vatable_sales || 0) - Number(data.vat_amount || 0)
              );
    receipt += `VATable (V): ${formatCurrency(rNet)}\n`;
    receipt += `Non-VATable: ${formatCurrency(data.non_vatable_sales || 0)}\n`;
    receipt += `VAT: ${formatCurrency(data.vat_amount || 0)}\n`;
    receipt += COMMANDS.BOLD_ON;
    receipt += `REFUND TOTAL: ${formatCurrency(data.total_amount || 0)}\n`;
    receipt += COMMANDS.BOLD_OFF;
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += separator() + '\n';

    if (data.refund_reason) {
        receipt += `Reason: ${data.refund_reason}\n`;
        receipt += separator() + '\n';
    }

    receipt += COMMANDS.ALIGN_CENTER;
    receipt += 'Refund confirmation.\n';
    receipt += 'Keep for your records.\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';

    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;

    return receipt;
}


// Build Library Session Receipt (legacy - for checkout summary if needed)
function buildLibraryReceipt(session) {
    let receipt = '';
    
    receipt += COMMANDS.INIT;
    receipt += COMMANDS.ALIGN_CENTER;
    
    // Header - normal size with bold (consistent with other receipts)
    receipt += COMMANDS.BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Study Session Summary\n';
    receipt += separator() + '\n';
    
    receipt += COMMANDS.ALIGN_LEFT;
    receipt += `Date: ${formatDateTime()}\n`;
    if (session.session_id) {
        receipt += `Session #: LIB-${String(session.session_id).padStart(6, '0')}\n`;
    }
    receipt += `Table: ${session.table_number}\n`;
    receipt += `Seat: ${session.seat_number}\n`;
    receipt += `Customer: ${session.customer_name}\n`;
    receipt += separator() + '\n';
    
    receipt += `Start: ${session.start_time}\n`;
    receipt += `End: ${session.end_time || formatDateTime()}\n`;
    receipt += `Duration: ${session.total_minutes || 0} mins\n`;
    receipt += separator() + '\n';
    
    // Charges breakdown
    receipt += 'CHARGES:\n';
    receipt += `Base (2 hrs): ${formatCurrency(100)}\n`;
    
    if (session.extension_fee && session.extension_fee > 0) {
        receipt += `Extensions: ${formatCurrency(session.extension_fee)}\n`;
    }
    
    receipt += separator() + '\n';
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.ALIGN_RIGHT;
    receipt += `TOTAL PAID: ${formatCurrency(session.total_amount || 100)}\n`;
    receipt += COMMANDS.BOLD_OFF;
    
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += 'Thank you for studying with us!\n';
    receipt += separator() + '\n';
    receipt += 'Powered by Spavion\n';
    receipt += '\n';
    receipt += 'NOT AN OFFICIAL RECEIPT\n';
    receipt += '\n';
    
    receipt += COMMANDS.FEED_LINES(1);
    receipt += COMMANDS.PARTIAL_CUT;
    
    return receipt;
}


// Print using ESC/POS direct USB (preferred method)
 
async function printWithESCPOS(order) {
    return new Promise((resolve, reject) => {
        if (!useDirectUSB) {
            reject(new Error('ESC/POS USB not available'));
            return;
        }

        try {
            const device = new USB();
            const printer = new escpos.Printer(device);
            const transactionNum = 'ORD-' + String(order.transaction_id || order.order_id || order.id).padStart(6, '0');
            const cashierFirstName = getFirstName(order.cashier_name);

            const printEscposCustomerCopy = (label) => {
                printer
                    .font('a')
                    .align('ct')
                    .style('b')
                    .size(2, 2)
                    .text('THE LIBRARY')
                    .size(1, 1)
                    .style('normal')
                    .text('Coffee + Study Hub')
                    .text('--------------------------------')
                    .style('b')
                    .text(label)
                    .style('normal')
                    .align('lt')
                    .text(`Date: ${formatDateTime()}`)
                    .text(`Order #: ${transactionNum}`)
                    .style('b')
                    .text(`Beeper #: ${order.beeper_number}`)
                    .style('normal')
                    .text(cashierFirstName ? `Cashier: ${cashierFirstName}` : '')
                    .text('--------------------------------')
                    .align('ct')
                    .text('ITEMS:')
                    .align('lt');

                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        const itemName = item.name || item.item_name;
                        const qty = item.quantity;
                        const price = parseFloat(item.price);
                        const subtotal = qty * price;

                        printer.text(`${qty}x ${itemName}`);
                        printer.text(`   @ ${price.toFixed(2)} = ${subtotal.toFixed(2)}`);
                    });
                }

                const subtotalVal = parseFloat(order.subtotal ?? order.total_amount ?? 0);
                const netV =
                    order.net_vatable_sales != null && order.net_vatable_sales !== undefined
                        ? parseFloat(order.net_vatable_sales)
                        : Math.max(
                              0,
                              parseFloat(order.vatable_sales || 0) - parseFloat(order.vat_amount || 0)
                          );
                const vatAmt = parseFloat(order.vat_amount || 0);
                const nonVat = parseFloat(order.non_vatable_sales || 0);
                const finalTot = parseFloat(order.final_amount ?? order.total_amount ?? 0);

                printer
                    .text('--------------------------------')
                    .align('rt')
                    .text(`Subtotal: ${subtotalVal.toFixed(2)}`);

                if (order.discount_amount && parseFloat(order.discount_amount) > 0) {
                    const dLabel = order.discount_name ? `Discount (${order.discount_name})` : 'Discount';
                    printer.text(`${dLabel}: -${parseFloat(order.discount_amount).toFixed(2)}`);
                }

                printer
                    .align('ct')
                    .style('b')
                    .text('TAX BREAKDOWN')
                    .style('normal')
                    .align('rt')
                    .text(`VATable (V): ${netV.toFixed(2)}`)
                    .text(`Non-VATable: ${nonVat.toFixed(2)}`)
                    .text(`VAT: ${vatAmt.toFixed(2)}`);

                printer
                    .style('b')
                    .text(`TOTAL: ${finalTot.toFixed(2)}`)
                    .style('normal');

                if (order.cash_tendered) {
                    printer
                        .text(`Cash: ${parseFloat(order.cash_tendered).toFixed(2)}`)
                        .text(`Change: ${parseFloat(order.change_due || 0).toFixed(2)}`);
                }

                printer
                    .text('')
                    .align('ct')
                    .text('--------------------------------')
                    .text('Thank you for visiting!')
                    .text('Please wait for your order')
                    .text('number to be called.')
                    .text('Powered by Spavion')
                    .text('--------------------------------')
                    .feed(1)
                    .cut();
            };

            device.open(function(err) {
                if (err) {
                    console.error('USB device open error:', err);
                    reject(err);
                    return;
                }

                printEscposCustomerCopy('CUSTOMER RECEIPT');
                printEscposCustomerCopy('STORE RECEIPT');

                printer.close(function() {
                        console.log('Receipt printed successfully via ESC/POS USB');
                        resolve(true);
                });
            });
        } catch (error) {
            console.error('ESC/POS print error:', error);
            reject(error);
        }
    });
}


// Print directly via USB using WinUSB driver
// This is the primary printing method after Zadig setup

async function printDirectUSB(data) {
    return new Promise((resolve, reject) => {
        if (!usb) {
            reject(new Error('USB module not available'));
            return;
        }
        
        const devices = usb.getDeviceList();
        const printer = devices.find(d => 
            d.deviceDescriptor.idVendor === USB_VENDOR_ID && 
            d.deviceDescriptor.idProduct === USB_PRODUCT_ID
        );
        
        if (!printer) {
            reject(new Error('Printer not found'));
            return;
        }
        
        try {
            printer.open();
            const iface = printer.interface(0);
            
            try {
                iface.claim();
            } catch (e) {
                // Interface may already be claimed, continue
            }
            
            // Find OUT endpoint
            let outEndpoint = null;
            for (const ep of iface.endpoints) {
                if (ep.direction === 'out') {
                    outEndpoint = ep;
                    break;
                }
            }
            
            if (!outEndpoint) {
                try { printer.close(); } catch (e) {}
                reject(new Error('No OUT endpoint found'));
                return;
            }
            
            // Convert string data to buffer if needed
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary');
            
            outEndpoint.transfer(buffer, (error) => {
                // Wait a bit before releasing/closing to avoid pending request error
                setTimeout(() => {
                    try {
                        iface.release(true, () => {
                            setTimeout(() => {
                                try { printer.close(); } catch (e) {}
                            }, 100);
                        });
                    } catch (e) {
                        try { printer.close(); } catch (e2) {}
                    }
                }, 100);
                
                if (error) {
                    reject(error);
                } else {
                    console.log('✅ Printed via direct USB');
                    resolve(true);
                }
            });
            
        } catch (error) {
            try { printer.close(); } catch (e) {}
            reject(error);
        }
    });
}


// Print to Windows printer using raw data
// Uses direct USB if available, falls back to PowerShell

async function printRaw(data, printerName = PRINTER_CONFIG.windowsPrinterName) {
    // Try direct USB first (fastest and most reliable after Zadig setup)
    if (useDirectUSB) {
        try {
            await printDirectUSB(data);
            return true;
        } catch (e) {
            console.log('Direct USB failed, trying PowerShell:', e.message);
        }
    }
    
    // Fallback to PowerShell Raw Printer API
    return printWithPowerShell(data, printerName);
}


// Print using Windows Raw Printer API via PowerShell
// Most reliable method for USB thermal printers on Windows

async function printWithPowerShell(data, printerName = PRINTER_CONFIG.windowsPrinterName) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(__dirname, `../temp/print_${Date.now()}.prn`);
        const tempDir = path.dirname(tempFile);
        const scriptPath = path.join(__dirname, '../scripts/print-raw.ps1');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        fs.writeFileSync(tempFile, data, { encoding: 'binary' });
        
        // Use the raw print PowerShell script
        const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printerName}" -FilePath "${tempFile}"`;
        
        exec(cmd, (error, stdout, stderr) => {
            // Clean up temp file
            try {
                setTimeout(() => fs.unlinkSync(tempFile), 2000);
            } catch (e) {}
            
            console.log('PowerShell output:', stdout);
            if (stderr) console.log('PowerShell stderr:', stderr);
            
            if (stdout.includes('SUCCESS')) {
                resolve(true);
            } else if (error || stdout.includes('FAILED')) {
                reject(new Error('Print failed via PowerShell'));
            } else {
                resolve(true);
            }
        });
    });
}


// Main print function - prints order receipt + station tickets

async function printOrderReceipts(order) {
    const results = {
        customerReceipt: false,
        clientReceipt: false,
        baristaTicket: false,
        kitchenTicket: false,
        errors: []
    };
    
    // Try ESC/POS direct USB first (preferred method)
    if (useDirectUSB) {
        try {
            await printWithESCPOS(order);
            results.customerReceipt = true;
            console.log('✅ Printed via ESC/POS USB');
            return results;
        } catch (error) {
            console.log('ESC/POS USB failed:', error.message);
            results.errors.push(`ESC/POS: ${error.message}`);
            // Fall through to Windows printing
        }
    }
    
    // Fallback to Windows printing
    try {
        // Print customer receipt
        const customerData = buildCustomerReceipt(order, 'CUSTOMER RECEIPT');
        await printRaw(customerData);
        results.customerReceipt = true;

        // Print additional store receipt copy
        const clientData = buildCustomerReceipt(order, 'STORE RECEIPT');
        await printRaw(clientData);
        results.clientReceipt = true;
    } catch (error) {
        results.errors.push(`Customer receipt: ${error.message}`);
    }
    
    // Check if there are barista items
    const hasBaristaItems = order.items?.some(item => 
        item.station === 'barista' || !item.station
    );
    
    if (hasBaristaItems) {
        try {
            const baristaData = buildBaristaTicket(order);
            await printRaw(baristaData);
            results.baristaTicket = true;
        } catch (error) {
            results.errors.push(`Barista ticket: ${error.message}`);
        }
    }
    
    // Check if there are kitchen items
    const hasKitchenItems = order.items?.some(item => item.station === 'kitchen');
    
    if (hasKitchenItems) {
        try {
            const kitchenData = buildKitchenTicket(order);
            await printRaw(kitchenData);
            results.kitchenTicket = true;
        } catch (error) {
            results.errors.push(`Kitchen ticket: ${error.message}`);
        }
    }
    
    return results;
}


// Print library session receipt

async function printLibraryReceipt(session) {
    try {
        const receiptData = buildLibraryReceipt(session);
        await printRaw(receiptData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print library check-in receipt (after initial payment)

async function printLibraryCheckinReceipt(session) {
    try {
        const receiptData = buildLibraryCheckinReceipt(session);
        await printRaw(receiptData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print library extension receipt (after extending time)

async function printLibraryExtensionReceipt(session) {
    try {
        const receiptData = buildLibraryExtensionReceipt(session);
        await printRaw(receiptData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print library checkout receipt (at session end)
async function printLibraryCheckoutReceipt(session) {
    try {
        const receiptData = buildLibraryCheckoutReceipt(session);
        await printRaw(receiptData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print barista ticket only
async function printBaristaTicket(order) {
    try {
        const ticketData = buildBaristaTicket(order);
        await printRaw(ticketData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print kitchen ticket only
async function printKitchenTicket(order) {
    try {
        const ticketData = buildKitchenTicket(order);
        await printRaw(ticketData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Print refund receipt
async function printRefundReceipt(data) {
    try {
        const receiptData = buildRefundReceipt(data);
        await printRaw(receiptData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Test print - useful for checking printer connection

async function testPrint() {
    // Try ESC/POS direct USB first
    if (useDirectUSB) {
        try {
            const device = new USB();
            const printer = new escpos.Printer(device);

            return new Promise((resolve, reject) => {
                device.open(function(err) {
                    if (err) {
                        console.log('USB open failed, trying Windows print');
                        reject(err);
                        return;
                    }

                    printer
                        .font('a')
                        .align('ct')
                        .style('b')
                        .size(2, 2)
                        .text('PRINTER TEST')
                        .size(1, 1)
                        .style('normal')
                        .text('--------------------------------')
                        .text(`Date: ${formatDateTime()}`)
                        .text('JK-5802H Connected!')
                        .text('ESC/POS USB Working!')
                        .text('--------------------------------')
                        .feed(3)
                        .cut()
                        .close(function() {
                            resolve({ success: true, message: 'Test print via ESC/POS USB successful!' });
                        });
                });
            });
        } catch (error) {
            console.log('ESC/POS test failed:', error.message);
            // Fall through to Windows printing
        }
    }

    // Fallback to raw printing
    let testData = '';
    testData += COMMANDS.INIT;
    testData += COMMANDS.ALIGN_CENTER;
    testData += COMMANDS.DOUBLE_SIZE;
    testData += 'PRINTER TEST\n';
    testData += COMMANDS.NORMAL_SIZE;
    testData += separator() + '\n';
    testData += `Date: ${formatDateTime()}\n`;
    testData += 'JK-5802H Connected!\n';
    testData += separator() + '\n';
    testData += COMMANDS.FEED_LINES(3);
    testData += COMMANDS.PARTIAL_CUT;
    
    try {
        await printRaw(testData);
        return { success: true, message: 'Test print sent successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Get list of available printers on Windows

async function getAvailablePrinters() {
    const printers = [];
    
    // Check for direct USB printer
    if (useDirectUSB && usb) {
        try {
            const devices = usb.getDeviceList();
            const printer = devices.find(d => 
                d.deviceDescriptor.idVendor === USB_VENDOR_ID && 
                d.deviceDescriptor.idProduct === USB_PRODUCT_ID
            );
            if (printer) {
                printers.push({
                    Name: 'JK-5802H Thermal Printer (USB Direct)',
                    PortName: 'USB',
                    DriverName: 'WinUSB',
                    VendorId: USB_VENDOR_ID.toString(16),
                    ProductId: USB_PRODUCT_ID.toString(16)
                });
            }
        } catch (e) {
            console.log('Error checking USB devices:', e.message);
        }
    }
    
    // Also get Windows printers
    return new Promise((resolve, reject) => {
        exec('powershell -Command "Get-Printer | Select-Object Name, PortName, DriverName | ConvertTo-Json"', 
            (error, stdout, stderr) => {
                if (error) {
                    resolve(printers);
                } else {
                    try {
                        const winPrinters = JSON.parse(stdout);
                        const winList = Array.isArray(winPrinters) ? winPrinters : [winPrinters];
                        resolve([...printers, ...winList]);
                    } catch (e) {
                        resolve(printers);
                    }
                }
            }
        );
    });
}

module.exports = {
    PRINTER_CONFIG,
    USB_VENDOR_ID,
    USB_PRODUCT_ID,
    useDirectUSB,
    buildCustomerReceipt,
    buildBaristaTicket,
    buildKitchenTicket,
    buildLibraryReceipt,
    buildLibraryCheckinReceipt,
    buildLibraryExtensionReceipt,
    buildLibraryCheckoutReceipt,
    buildRefundReceipt,
    printRaw,
    printDirectUSB,
    printWithPowerShell,
    printWithESCPOS,
    printOrderReceipts,
    printBaristaTicket,
    printKitchenTicket,
    printLibraryReceipt,
    printLibraryCheckinReceipt,
    printLibraryExtensionReceipt,
    printLibraryCheckoutReceipt,
    printRefundReceipt,
    testPrint,
    getAvailablePrinters
};