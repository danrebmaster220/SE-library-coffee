/**
 * Web-Based Printer Service
 * 
 * Generates styled HTML receipts and triggers the browser's print dialog.
 * Used as an alternative to physical thermal printing when the backend
 * is hosted in the cloud and can't reach a USB printer.
 * 
 * Receipt types:
 * - Customer receipt (order details + payment)
 * - Barista ticket (drink preparation)
 * - Kitchen ticket (food preparation)
 * - Library check-in receipt
 * - Library extension receipt
 */

// ============================================
// Receipt Styles (58mm thermal receipt look)
// ============================================
const RECEIPT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    width: 58mm;
    margin: 0 auto;
    padding: 4mm 2mm;
  }

  .receipt { 
    width: 100%; 
    page-break-after: always;
  }

  .receipt:last-child {
    page-break-after: avoid;
  }

  .receipt-header {
    text-align: center;
    margin-bottom: 6px;
  }

  .store-name {
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 1px;
  }

  .store-sub {
    font-size: 11px;
  }

  .separator {
    text-align: center;
    margin: 4px 0;
    letter-spacing: 1px;
    font-size: 11px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .info-label { font-weight: normal; }
  .info-value { text-align: right; }

  .section-title {
    font-weight: bold;
    font-size: 12px;
    margin-top: 4px;
  }

  .item-row { margin: 4px 0; }

  .item-name {
    font-size: 12px;
    font-weight: bold;
  }

  .item-detail {
    font-size: 10px;
    padding-left: 12px;
    color: #333;
  }

  .item-price {
    font-size: 11px;
    padding-left: 12px;
  }

  .totals {
    text-align: right;
    margin-top: 4px;
  }

  .totals .row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .totals .total-final {
    font-weight: bold;
    font-size: 13px;
    border-top: 1px dashed #000;
    padding-top: 2px;
    margin-top: 2px;
  }

  .footer {
    text-align: center;
    margin-top: 8px;
    font-size: 10px;
  }

  .footer p { margin: 2px 0; }

  .ticket-header {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    border: 2px solid #000;
    padding: 4px;
    margin-bottom: 6px;
  }

  .order-number {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    margin: 4px 0;
  }

  .booking-section {
    border: 1px dashed #000;
    padding: 4px;
    margin: 6px 0;
  }

  .booking-section .title {
    font-weight: bold;
    font-size: 12px;
  }

  @media print {
    @page {
      size: 58mm auto;
      margin: 0;
    }
    body {
      width: 58mm;
      padding: 2mm;
    }
  }
`;

// ============================================
// Helper Functions
// ============================================

function formatCurrency(amount) {
  return `₱${parseFloat(amount || 0).toFixed(2)}`;
}

function formatDateTime(dateStr) {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getSizeAbbrev(sizeName) {
  if (!sizeName) return '';
  const lower = sizeName.toLowerCase();
  if (lower.includes('large')) return '(L)';
  if (lower.includes('medium')) return '(M)';
  if (lower.includes('small')) return '(S)';
  return '';
}

function parseCustomizations(customizations) {
  if (!customizations || customizations.length === 0) return { size: '', temp: '', addons: [] };
  
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
      addons.push({
        name: optionName,
        quantity: c.quantity || 1,
        price: parseFloat(c.total_price || c.unit_price || 0)
      });
    }
  });
  
  return { size, temp, addons };
}

const SEP = '--------------------------------';

// ============================================
// Receipt Builders (return HTML strings)
// ============================================

function buildCustomerReceiptHTML(data) {
  const transactionNum = 'ORD-' + String(data.transaction_id).padStart(6, '0');
  
  let itemsHTML = '';
  (data.items || []).forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    let nameStr = `${item.quantity}x ${item.name}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${nameStr}</div>`;
    
    if (customs.temp) {
      itemsHTML += `<div class="item-detail">[${customs.temp}]</div>`;
    }
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      const priceStr = addon.price > 0 ? ` (+${formatCurrency(addon.price)})` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${addon.name}${priceStr}</div>`;
    });
    
    let itemTotal = item.unit_price * item.quantity;
    customs.addons.forEach(a => { itemTotal += a.price; });
    
    itemsHTML += `<div class="item-price">@ ${formatCurrency(item.unit_price)} = ${formatCurrency(itemTotal)}</div>`;
    itemsHTML += `</div>`;
  });
  
  // Library booking section
  let bookingHTML = '';
  if (data.library_booking) {
    const lb = data.library_booking;
    const durationHours = Math.floor(lb.duration_minutes / 60);
    const durationMins = lb.duration_minutes % 60;
    let durationStr = `${durationHours}h`;
    if (durationMins > 0) durationStr += ` ${durationMins}m`;
    
    bookingHTML = `
      <div class="separator">${SEP}</div>
      <div class="booking-section">
        <div class="title">STUDY AREA BOOKING:</div>
        <div>Table ${lb.table_number}, Seat ${lb.seat_number}</div>
        <div>Duration: ${durationStr}</div>
        <div style="text-align:right;">Study Area: ${formatCurrency(lb.amount)}</div>
      </div>
    `;
  }

  return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="store-name">THE LIBRARY</div>
        <div class="store-sub">Coffee + Study</div>
        <div class="store-sub">Pavilion, Nunez St.</div>
        <div class="store-sub">Zamboanga City</div>
      </div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime(data.created_at)}</span></div>
      <div class="info-row"><span>Transaction #:</span><span>${transactionNum}</span></div>
      <div class="info-row"><span>Order #:</span><span>${data.beeper_number}</span></div>
      ${data.cashier_name ? `<div class="info-row"><span>Cashier:</span><span>${data.cashier_name}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">ITEMS:</div>
      ${itemsHTML}
      <div class="separator">${SEP}</div>
      ${bookingHTML}
      <div class="totals">
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div>
        ${data.discount_amount > 0 ? `<div class="row"><span>Discount${data.discount_name ? ` (${data.discount_name})` : ''}:</span><span>-${formatCurrency(data.discount_amount)}</span></div>` : ''}
        <div class="row total-final"><span>TOTAL:</span><span>${formatCurrency(data.total_amount)}</span></div>
        ${data.cash_tendered ? `<div class="row"><span>Cash:</span><span>${formatCurrency(data.cash_tendered)}</span></div>` : ''}
        ${data.cash_tendered ? `<div class="row"><span>Change:</span><span>${formatCurrency(data.change_due)}</span></div>` : ''}
      </div>
      <div class="separator">${SEP}</div>
      <div class="footer">
        <p>Thank you for visiting!</p>
        <p>Please wait for your order</p>
        <p>number to be called.</p>
        <p class="separator">${SEP}</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildBaristaTicketHTML(data) {
  const baristaItems = (data.items || []).filter(item => 
    item.station === 'barista' || !item.station
  );
  
  if (baristaItems.length === 0) return '';
  
  let itemsHTML = '';
  baristaItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    let nameStr = `${item.quantity}x ${item.name}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${nameStr}</div>`;
    
    if (customs.temp) {
      itemsHTML += `<div class="item-detail">&gt;&gt; ${customs.temp.toUpperCase()}</div>`;
    }
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${addon.name}</div>`;
    });
    itemsHTML += `</div>`;
  });
  
  let bookingHTML = '';
  if (data.library_booking) {
    const lb = data.library_booking;
    bookingHTML = `
      <div class="separator">${SEP}</div>
      <div style="text-align:center;font-weight:bold;">STUDY AREA: T${lb.table_number}-S${lb.seat_number}</div>
    `;
  }
  
  return `
    <div class="receipt">
      <div class="ticket-header">*** BARISTA ***</div>
      <div class="order-number">ORDER #${data.beeper_number}</div>
      <div class="info-row"><span>Time:</span><span>${formatDateTime(data.created_at)}</span></div>
      ${data.cashier_name ? `<div class="info-row"><span>Cashier:</span><span>${data.cashier_name}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      ${itemsHTML}
      ${bookingHTML}
      <div class="separator">${SEP}</div>
    </div>
  `;
}

function buildKitchenTicketHTML(data) {
  const kitchenItems = (data.items || []).filter(item => item.station === 'kitchen');
  
  if (kitchenItems.length === 0) return '';
  
  let itemsHTML = '';
  kitchenItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${item.quantity}x ${item.name}</div>`;
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${addon.name}</div>`;
    });
    itemsHTML += `</div>`;
  });
  
  return `
    <div class="receipt">
      <div class="ticket-header">*** KITCHEN ***</div>
      <div class="order-number">ORDER #${data.beeper_number}</div>
      <div class="info-row"><span>Time:</span><span>${formatDateTime(data.created_at)}</span></div>
      ${data.cashier_name ? `<div class="info-row"><span>Cashier:</span><span>${data.cashier_name}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      ${itemsHTML}
      <div class="separator">${SEP}</div>
    </div>
  `;
}

function buildLibraryCheckinReceiptHTML(session) {
  const durationMins = session.paid_minutes || session.duration_minutes || 120;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  let durationStr = `${hours} hour${hours > 1 ? 's' : ''}`;
  if (mins > 0) durationStr += ` ${mins} mins`;

  return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="store-name">THE LIBRARY</div>
        <div class="store-sub">Study Space Check-in</div>
      </div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime()}</span></div>
      ${session.session_id ? `<div class="info-row"><span>Session #:</span><span>LIB-${String(session.session_id).padStart(6, '0')}</span></div>` : ''}
      <div class="info-row"><span>Table:</span><span>${session.table_number}</span></div>
      <div class="info-row"><span>Seat:</span><span>${session.seat_number}</span></div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Customer:</span><span>${session.customer_name}</span></div>
      ${session.cashier_name ? `<div class="info-row"><span>Cashier:</span><span>${session.cashier_name}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">SESSION DETAILS:</div>
      <div class="info-row"><span>Start Time:</span><span>${formatDateTime()}</span></div>
      <div class="info-row"><span>Duration:</span><span>${durationStr}</span></div>
      <div class="separator">${SEP}</div>
      <div class="totals">
        <div class="row total-final"><span>AMOUNT PAID:</span><span>${formatCurrency(session.amount_paid || 100)}</span></div>
        ${session.cash_tendered ? `<div class="row"><span>Cash:</span><span>${formatCurrency(session.cash_tendered)}</span></div>` : ''}
        ${session.cash_tendered ? `<div class="row"><span>Change:</span><span>${formatCurrency(session.change_due || 0)}</span></div>` : ''}
      </div>
      <div class="separator">${SEP}</div>
      <div class="footer">
        <p>Extension: ₱50.00 per 30 mins</p>
        <p class="separator">${SEP}</p>
        <p>Thank you!</p>
        <p>Enjoy your study session.</p>
        <p class="separator">${SEP}</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildLibraryExtensionReceiptHTML(session) {
  return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="store-name">THE LIBRARY</div>
        <div class="store-sub">Session Extension</div>
      </div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime()}</span></div>
      ${session.session_id ? `<div class="info-row"><span>Session #:</span><span>LIB-${String(session.session_id).padStart(6, '0')}</span></div>` : ''}
      <div class="info-row"><span>Table:</span><span>${session.table_number}</span></div>
      <div class="info-row"><span>Seat:</span><span>${session.seat_number}</span></div>
      <div class="info-row"><span>Customer:</span><span>${session.customer_name}</span></div>
      ${session.cashier_name ? `<div class="info-row"><span>Cashier:</span><span>${session.cashier_name}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">EXTENSION:</div>
      <div class="info-row"><span>Added Time:</span><span>+${session.added_minutes} minutes</span></div>
      <div class="info-row"><span>Extension Fee:</span><span>${formatCurrency(session.extension_fee)}</span></div>
      <div class="separator">${SEP}</div>
      <div class="section-title">UPDATED SESSION:</div>
      <div class="info-row"><span>Total Time:</span><span>${session.new_total_minutes} minutes</span></div>
      <div class="info-row"><span>Remaining:</span><span>${session.remaining_minutes} minutes</span></div>
      <div class="separator">${SEP}</div>
      <div class="totals">
        <div class="row total-final"><span>PAID:</span><span>${formatCurrency(session.extension_fee)}</span></div>
        ${session.cash_tendered ? `<div class="row"><span>Cash:</span><span>${formatCurrency(session.cash_tendered)}</span></div>` : ''}
        ${session.cash_tendered ? `<div class="row"><span>Change:</span><span>${formatCurrency(session.change_due || 0)}</span></div>` : ''}
      </div>
      <div class="separator">${SEP}</div>
      <div class="footer">
        <p>Thank you for extending!</p>
        <p class="separator">${SEP}</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

// ============================================
// Print Trigger (opens browser print dialog)
// ============================================

function triggerPrint(htmlContent) {
  return new Promise((resolve) => {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '58mm';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>${RECEIPT_STYLES}</style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `);
    doc.close();
    
    // Wait for content to render, then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Clean up after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve(true);
        }, 1000);
      }, 300);
    };
  });
}

// ============================================
// Public API
// ============================================

/**
 * Print order receipts (customer + barista + kitchen tickets)
 * @param {Object} receiptData - Receipt data from /printer/receipt-data/:id
 */
export async function printOrderReceipt(receiptData) {
  let html = '';
  
  // Customer receipt
  html += buildCustomerReceiptHTML(receiptData);
  
  // Barista ticket (if has barista items)
  const baristaHTML = buildBaristaTicketHTML(receiptData);
  if (baristaHTML) html += baristaHTML;
  
  // Kitchen ticket (if has kitchen items)
  const kitchenHTML = buildKitchenTicketHTML(receiptData);
  if (kitchenHTML) html += kitchenHTML;
  
  return triggerPrint(html);
}

/**
 * Print customer receipt only (for reprints)
 * @param {Object} receiptData - Receipt data from /printer/receipt-data/:id
 */
export async function printCustomerReceipt(receiptData) {
  const html = buildCustomerReceiptHTML(receiptData);
  return triggerPrint(html);
}

/**
 * Print library check-in receipt
 * @param {Object} session - Session data with table_number, seat_number, customer_name, etc.
 */
export async function printLibraryCheckinReceipt(session) {
  const html = buildLibraryCheckinReceiptHTML(session);
  return triggerPrint(html);
}

/**
 * Print library extension receipt
 * @param {Object} session - Session data with added_minutes, extension_fee, etc.
 */
export async function printLibraryExtensionReceipt(session) {
  const html = buildLibraryExtensionReceiptHTML(session);
  return triggerPrint(html);
}

export default {
  printOrderReceipt,
  printCustomerReceipt,
  printLibraryCheckinReceipt,
  printLibraryExtensionReceipt
};
