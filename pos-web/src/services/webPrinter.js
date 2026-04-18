/**
 * Web-Based Printer Service
 * 
 * Generates styled HTML receipts and shows them in a preview modal overlay.
 * When "Print" is clicked, opens a popup with plain-text receipt optimized
 * for 58mm POS thermal printers and triggers browser print dialog.
 * 
 * Receipt types:
 * - Customer receipt (order details + payment)
 * - Barista ticket (drink preparation)
 * - Kitchen ticket (food preparation)
 * - Library check-in receipt
 * - Library extension receipt
 */

// ============================================
// Receipt Styles (used inside the modal paper & print popup)
// ============================================
const RECEIPT_STYLES = `
  .receipt { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px dashed #ccc; }
  .receipt:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .receipt-header { text-align: center; margin-bottom: 6px; }
  .store-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
  .store-sub { font-size: 11px; }
  .separator { text-align: center; margin: 4px 0; font-size: 11px; color: #888; }
  .info-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
  .info-label { font-weight: normal; }
  .info-value { text-align: right; }
  .section-title { font-weight: bold; font-size: 12px; margin-top: 4px; }
  .item-row { margin: 5px 0; }
  .item-name { font-size: 12px; font-weight: bold; }
  .item-detail { font-size: 10px; padding-left: 12px; color: #444; }
  .item-price { font-size: 11px; padding-left: 12px; }
  .totals { margin-top: 4px; }
  .totals .row { display: flex; justify-content: space-between; font-size: 11px; }
  .totals .total-final { font-weight: bold; font-size: 13px; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; }
  .footer p { margin: 2px 0; }
  .ticket-header { text-align: center; font-size: 15px; font-weight: bold; border: 2px solid #000; padding: 4px; margin-bottom: 6px; }
  .order-number { text-align: center; font-size: 18px; font-weight: bold; margin: 4px 0; }
  .booking-section { border: 1px dashed #000; padding: 4px; margin: 6px 0; }
  .booking-section .title { font-weight: bold; font-size: 12px; }
`;

// ============================================
// Helper Functions
// ============================================

function formatCurrency(amount) {
  return `${parseFloat(amount || 0).toFixed(2)}`;
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

function getFirstName(name) {
  if (!name) return '';
  return String(name).trim().split(/\s+/)[0] || '';
}

/** Safe text for HTML receipt templates (names from DB / API). */
function escapeHtml(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function buildCustomerReceiptHTML(data, copyLabel = 'CUSTOMER RECEIPT') {
  const transactionNum = 'ORD-' + String(data.transaction_id).padStart(6, '0');
  const cashierFirstName = getFirstName(data.cashier_name);
  
  let itemsHTML = '';
  (data.items || []).forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    let nameStr = `${item.quantity}x ${escapeHtml(item.name || '')}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${nameStr}</div>`;
    
    if (customs.temp) {
      itemsHTML += `<div class="item-detail">[${escapeHtml(customs.temp)}]</div>`;
    }
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      const priceStr = addon.price > 0 ? ` (+${formatCurrency(addon.price)})` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${escapeHtml(addon.name)}${priceStr}</div>`;
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
      <div class="section-title" style="text-align:center;">${escapeHtml(copyLabel)}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime(data.created_at)}</span></div>
      <div class="info-row"><span>Order #:</span><span>${transactionNum}</span></div>
      <div class="info-row"><span>Beeper #:</span><span>${data.beeper_number}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">ITEMS:</div>
      ${itemsHTML}
      <div class="separator">${SEP}</div>
      ${bookingHTML}
      <div class="totals">
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div>
        ${data.discount_amount > 0 ? `<div class="row"><span>Discount${data.discount_name ? ` (${escapeHtml(data.discount_name)})` : ''}:</span><span>-${formatCurrency(data.discount_amount)}</span></div>` : ''}
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
        <p>Powered by Spavion</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildBaristaTicketHTML(data) {
  const cashierFirstName = getFirstName(data.cashier_name);
  const baristaItems = (data.items || []).filter(item => 
    item.station === 'barista' || !item.station
  );
  
  if (baristaItems.length === 0) return '';
  
  let itemsHTML = '';
  baristaItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    let nameStr = `${item.quantity}x ${escapeHtml(item.name || '')}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${nameStr}</div>`;
    
    if (customs.temp) {
      itemsHTML += `<div class="item-detail">&gt;&gt; ${escapeHtml(String(customs.temp).toUpperCase())}</div>`;
    }
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${escapeHtml(addon.name)}</div>`;
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
      <div class="order-number">BEEPER #${data.beeper_number}</div>
      <div class="info-row"><span>Time:</span><span>${formatDateTime(data.created_at)}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      ${itemsHTML}
      ${bookingHTML}
      <div class="separator">${SEP}</div>
    </div>
  `;
}

function buildKitchenTicketHTML(data) {
  const cashierFirstName = getFirstName(data.cashier_name);
  const kitchenItems = (data.items || []).filter(item => item.station === 'kitchen');
  
  if (kitchenItems.length === 0) return '';
  
  let itemsHTML = '';
  kitchenItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${item.quantity}x ${escapeHtml(item.name || '')}</div>`;
    
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      itemsHTML += `<div class="item-detail">+ ${qty}${escapeHtml(addon.name)}</div>`;
    });
    itemsHTML += `</div>`;
  });
  
  return `
    <div class="receipt">
      <div class="ticket-header">*** KITCHEN ***</div>
      <div class="order-number">BEEPER #${data.beeper_number}</div>
      <div class="info-row"><span>Time:</span><span>${formatDateTime(data.created_at)}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      ${itemsHTML}
      <div class="separator">${SEP}</div>
    </div>
  `;
}

function buildLibraryCheckinReceiptHTML(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
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
      <div class="info-row"><span>Customer:</span><span>${escapeHtml(session.customer_name)}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
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
        <p>Extension: 50.00 per 30 mins</p>
        <p class="separator">${SEP}</p>
        <p>Thank you!</p>
        <p>Enjoy your study session.</p>
        <p class="separator">${SEP}</p>
        <p>Powered by Spavion</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildLibraryExtensionReceiptHTML(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
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
      <div class="info-row"><span>Customer:</span><span>${escapeHtml(session.customer_name)}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
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
        <p>Powered by Spavion</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildLibraryCheckoutReceiptHTML(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
  const startLabel = session.start_time ? formatDateTime(session.start_time) : '-';
  const endLabel = session.end_time ? formatDateTime(session.end_time) : formatDateTime();

  return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="store-name">THE LIBRARY</div>
        <div class="store-sub">Session Checkout</div>
      </div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime()}</span></div>
      ${session.session_id ? `<div class="info-row"><span>Session #:</span><span>LIB-${String(session.session_id).padStart(6, '0')}</span></div>` : ''}
      <div class="info-row"><span>Table:</span><span>${session.table_number || '-'}</span></div>
      <div class="info-row"><span>Seat:</span><span>${session.seat_number || '-'}</span></div>
      <div class="info-row"><span>Customer:</span><span>${escapeHtml(session.customer_name || '-')}</span></div>
      ${cashierFirstName ? `<div class="info-row"><span>Cashier:</span><span>${escapeHtml(cashierFirstName)}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">SESSION SUMMARY:</div>
      <div class="info-row"><span>Start:</span><span>${startLabel}</span></div>
      <div class="info-row"><span>End:</span><span>${endLabel}</span></div>
      <div class="info-row"><span>Used Time:</span><span>${session.total_minutes || 0} mins</span></div>
      <div class="info-row"><span>Paid Time:</span><span>${session.paid_minutes || 0} mins</span></div>
      <div class="separator">${SEP}</div>
      <div class="totals">
        <div class="row total-final"><span>TOTAL PAID:</span><span>${formatCurrency(session.amount_paid || 0)}</span></div>
      </div>
      <div class="separator">${SEP}</div>
      <div class="footer">
        <p>Thank you for studying with us!</p>
        <p class="separator">${SEP}</p>
        <p>Powered by Spavion</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

// ============================================
// Local Print Server (localhost:9100)
// ============================================

const PRINT_SERVER_URL = 'http://localhost:9100';

/**
 * Try to print via the local print server.
 * Returns true if successful, false if server is unreachable.
 */
async function tryLocalPrint(receiptData, endpoint = '/print') {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData),
    });
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.warn('Local print server not available:', err.message);
    return false;
  }
}

// ============================================
// Modal Overlay (shows receipt preview in-app)
// ============================================

function showReceiptModal(htmlContent, title = 'Receipt Preview', receiptData = null, printEndpoint = '/print', options = {}) {
  const { autoPrint = false } = options;
  return new Promise((resolve) => {
    // Remove any existing modal
    const existing = document.getElementById('receipt-preview-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'receipt-preview-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); display: flex; align-items: center;
      justify-content: center; z-index: 99999; backdrop-filter: blur(3px);
    `;

    // Modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-height: 90vh; width: 380px; max-width: 95vw;
      display: flex; flex-direction: column; overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; background: #3D2415; color: #F5E6D3;
      font-family: 'Poppins', sans-serif;
    `;
    header.innerHTML = `
      <span style="font-size:15px;font-weight:600;">🧾 ${title}</span>
      <span id="rp-close-x" style="cursor:pointer;font-size:22px;line-height:1;padding:2px 6px;border-radius:4px;transition:background 0.2s;">&times;</span>
    `;

    // Receipt content (scrollable)
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1; overflow-y: auto; padding: 20px; background: #f9f5f0;
    `;

    // Receipt paper
    const paper = document.createElement('div');
    paper.style.cssText = `
      background: #fff; border: 1px solid #e0d5ca; border-radius: 4px;
      padding: 16px 14px; font-family: 'Courier New', 'Consolas', monospace;
      font-size: 12px; line-height: 1.5; color: #000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 300px; margin: 0 auto;
    `;

    const style = document.createElement('style');
    style.textContent = RECEIPT_STYLES;
    paper.appendChild(style);
    paper.innerHTML += htmlContent;

    content.appendChild(paper);

    // Footer buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex; gap: 10px; padding: 14px 20px; background: #fff;
      border-top: 1px solid #eee; justify-content: center;
    `;
    footer.innerHTML = `
      <button id="rp-print-btn" style="
        padding:10px 28px; border:1px solid #3D2415; background:#fff; color:#3D2415;
        border-radius:6px; cursor:pointer; font-size:14px; font-family:'Poppins',sans-serif;
        font-weight:600; transition:all 0.2s;
      ">🖨️ Print</button>
      <button id="rp-done-btn" style="
        padding:10px 28px; border:none; background:#3D2415; color:#F5E6D3;
        border-radius:6px; cursor:pointer; font-size:14px; font-family:'Poppins',sans-serif;
        font-weight:600; transition:all 0.2s;
      ">✓ Done</button>
    `;

    // Assemble
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close helper
    const closeModal = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleEsc);
      resolve(true);
    };

    // Event listeners
    document.getElementById('rp-close-x').onclick = closeModal;
    document.getElementById('rp-done-btn').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    // Print button — try print server first, fall back to browser window.print()
    const handlePrint = async () => {
      const btn = document.getElementById('rp-print-btn');
      if (!btn || btn.style.pointerEvents === 'none') return;
      btn.innerHTML = '⏳ Printing...';
      btn.style.pointerEvents = 'none';

      // 1. Try local print server (localhost:9100)
      if (receiptData) {
        const ok = await tryLocalPrint(receiptData, printEndpoint);
        if (ok) {
          btn.innerHTML = '✅ Printed!';
          btn.style.background = '#e8f5e9';
          btn.style.color = '#2e7d32';
          btn.style.borderColor = '#2e7d32';
          setTimeout(() => {
            btn.innerHTML = '🖨️ Print';
            btn.style.background = '#fff';
            btn.style.color = '#3D2415';
            btn.style.borderColor = '#3D2415';
            btn.style.pointerEvents = 'auto';
          }, 2000);
          return;
        }
      }

      // 2. Print server not available — fall back to browser print (window.print)
      btn.innerHTML = '🖨️ Print';
      btn.style.pointerEvents = 'auto';
      openThermalPrint(receiptData, printEndpoint);
    };

    document.getElementById('rp-print-btn').onclick = handlePrint;

    // Hover effects
    const closeX = document.getElementById('rp-close-x');
    closeX.onmouseenter = () => { closeX.style.background = 'rgba(255,255,255,0.15)'; };
    closeX.onmouseleave = () => { closeX.style.background = 'transparent'; };
    const printBtn = document.getElementById('rp-print-btn');
    printBtn.onmouseenter = () => { printBtn.style.background = '#f5efe8'; };
    printBtn.onmouseleave = () => { printBtn.style.background = '#fff'; };
    const doneBtn = document.getElementById('rp-done-btn');
    doneBtn.onmouseenter = () => { doneBtn.style.background = '#5a3520'; };
    doneBtn.onmouseleave = () => { doneBtn.style.background = '#3D2415'; };

    // ESC to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEsc);

    if (autoPrint) {
      setTimeout(() => {
        handlePrint();
      }, 150);
    }
  });
}

// ============================================
// Plain-Text Receipt Builders (for window.print fallback)
// These build structured monospace text that looks identical
// to the ESC/POS print server output on thermal printers.
// Width: 32 characters (58mm paper)
// ============================================
const W = 32;
const TXT_SEP = '-'.repeat(W);
const TXT_DBL_SEP = '='.repeat(W);

function txtCenter(text) {
  const pad = Math.max(0, Math.floor((W - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function txtLR(left, right) {
  const gap = Math.max(1, W - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function txtMoney(amount) {
  return parseFloat(amount || 0).toFixed(2);
}

function buildPlainTextCustomerReceipt(data, copyLabel = 'CUSTOMER RECEIPT') {
  const cashierFirstName = getFirstName(data.cashier_name);
  const lines = [];
  lines.push(txtCenter('THE LIBRARY'));
  lines.push(txtCenter('Coffee + Study'));
  lines.push(txtCenter('Pavilion, Nunez St.'));
  lines.push(txtCenter('Zamboanga City'));
  lines.push(TXT_SEP);
  lines.push(txtCenter(copyLabel));
  lines.push(TXT_SEP);

  const txnId = 'ORD-' + String(data.transaction_id).padStart(6, '0');
  const dateStr = formatDateTime(data.created_at);
  lines.push(txtLR('Date:', dateStr));
  lines.push(txtLR('Order #:', txnId));
  if (data.beeper_number) lines.push(txtLR('Beeper #:', String(data.beeper_number)));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);

  lines.push('ITEMS:');
  (data.items || []).forEach(item => {
    const customs = parseCustomizations(item.customizations);
    let nameStr = `${item.quantity}x ${item.name}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    lines.push(nameStr);
    if (customs.temp) lines.push(`  [${customs.temp}]`);
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      const price = addon.price > 0 ? ` (+${txtMoney(addon.price)})` : '';
      lines.push(`  + ${qty}${addon.name}${price}`);
    });
    let itemTotal = item.unit_price * item.quantity;
    customs.addons.forEach(a => { itemTotal += a.price; });
    lines.push(`  @ ${txtMoney(item.unit_price)} = ${txtMoney(itemTotal)}`);
    lines.push('');
  });

  if (data.library_booking) {
    const lb = data.library_booking;
    lines.push(TXT_SEP);
    lines.push('STUDY AREA BOOKING:');
    lines.push(`Table ${lb.table_number}, Seat ${lb.seat_number}`);
    const dur = lb.duration_minutes;
    const h = Math.floor(dur / 60);
    const m = dur % 60;
    lines.push(`Duration: ${h}h${m > 0 ? ` ${m}m` : ''}`);
    lines.push(txtLR('Study Area:', txtMoney(lb.amount)));
  }

  lines.push(TXT_SEP);
  lines.push(txtLR('Subtotal:', txtMoney(data.subtotal)));
  if (data.discount_amount > 0) {
    const dl = data.discount_name ? `Disc (${data.discount_name}):` : 'Discount:';
    lines.push(txtLR(dl, '-' + txtMoney(data.discount_amount)));
  }
  lines.push(TXT_DBL_SEP);
  lines.push(txtLR('TOTAL:', txtMoney(data.total_amount)));
  if (data.cash_tendered) {
    lines.push(txtLR('Cash:', txtMoney(data.cash_tendered)));
    lines.push(txtLR('Change:', txtMoney(data.change_due || 0)));
  }
  lines.push(TXT_SEP);
  lines.push(txtCenter('Thank you for visiting!'));
  lines.push(txtCenter('Please wait for your order'));
  lines.push(txtCenter('number to be called.'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Powered by Spavion'));
  lines.push(txtCenter('NOT AN OFFICIAL RECEIPT'));

  return lines.join('\n');
}

function buildPlainTextBaristaTicket(data) {
  const cashierFirstName = getFirstName(data.cashier_name);
  const baristaItems = (data.items || []).filter(i => i.station === 'barista' || !i.station);
  if (baristaItems.length === 0) return '';

  const lines = [];
  lines.push(txtCenter('*** BARISTA ***'));
  lines.push(TXT_SEP);
  lines.push(txtCenter(`BEEPER #${data.beeper_number}`));
  lines.push(txtLR('Time:', formatDateTime(data.created_at)));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);

  baristaItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    let nameStr = `${item.quantity}x ${item.name}`;
    if (customs.size) nameStr += ` ${getSizeAbbrev(customs.size)}`;
    lines.push(nameStr);
    if (customs.temp) lines.push(`  >> ${customs.temp.toUpperCase()}`);
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      lines.push(`  + ${qty}${addon.name}`);
    });
    lines.push('');
  });

  if (data.library_booking) {
    const lb = data.library_booking;
    lines.push(TXT_SEP);
    lines.push(txtCenter(`STUDY AREA: T${lb.table_number}-S${lb.seat_number}`));
  }
  lines.push(TXT_SEP);

  return lines.join('\n');
}

function buildPlainTextKitchenTicket(data) {
  const cashierFirstName = getFirstName(data.cashier_name);
  const kitchenItems = (data.items || []).filter(i => i.station === 'kitchen');
  if (kitchenItems.length === 0) return '';

  const lines = [];
  lines.push(txtCenter('*** KITCHEN ***'));
  lines.push(TXT_SEP);
  lines.push(txtCenter(`BEEPER #${data.beeper_number}`));
  lines.push(txtLR('Time:', formatDateTime(data.created_at)));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);

  kitchenItems.forEach(item => {
    const customs = parseCustomizations(item.customizations);
    lines.push(`${item.quantity}x ${item.name}`);
    customs.addons.forEach(addon => {
      const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
      lines.push(`  + ${qty}${addon.name}`);
    });
    lines.push('');
  });
  lines.push(TXT_SEP);

  return lines.join('\n');
}

function buildPlainTextLibraryCheckin(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
  const durationMins = session.paid_minutes || session.duration_minutes || 120;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  let durationStr = `${hours} hour${hours > 1 ? 's' : ''}`;
  if (mins > 0) durationStr += ` ${mins} mins`;

  const lines = [];
  lines.push(txtCenter('THE LIBRARY'));
  lines.push(txtCenter('Study Space Check-in'));
  lines.push(TXT_SEP);
  lines.push(txtLR('Date:', formatDateTime()));
  if (session.session_id) lines.push(txtLR('Session #:', 'LIB-' + String(session.session_id).padStart(6, '0')));
  lines.push(txtLR('Table:', String(session.table_number)));
  lines.push(txtLR('Seat:', String(session.seat_number)));
  lines.push(TXT_SEP);
  lines.push(txtLR('Customer:', session.customer_name));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);
  lines.push('SESSION DETAILS:');
  lines.push(txtLR('Start Time:', formatDateTime()));
  lines.push(txtLR('Duration:', durationStr));
  lines.push(TXT_DBL_SEP);
  lines.push(txtLR('AMOUNT PAID:', txtMoney(session.amount_paid || 100)));
  if (session.cash_tendered) {
    lines.push(txtLR('Cash:', txtMoney(session.cash_tendered)));
    lines.push(txtLR('Change:', txtMoney(session.change_due || 0)));
  }
  lines.push(TXT_SEP);
  lines.push(txtCenter('Extension: 50.00 per 30 mins'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Thank you!'));
  lines.push(txtCenter('Enjoy your study session.'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Powered by Spavion'));
  lines.push(txtCenter('NOT AN OFFICIAL RECEIPT'));

  return lines.join('\n');
}

function buildPlainTextLibraryExtension(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
  const lines = [];
  lines.push(txtCenter('THE LIBRARY'));
  lines.push(txtCenter('Session Extension'));
  lines.push(TXT_SEP);
  lines.push(txtLR('Date:', formatDateTime()));
  if (session.session_id) lines.push(txtLR('Session #:', 'LIB-' + String(session.session_id).padStart(6, '0')));
  lines.push(txtLR('Table:', String(session.table_number)));
  lines.push(txtLR('Seat:', String(session.seat_number)));
  lines.push(txtLR('Customer:', session.customer_name));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);
  lines.push('EXTENSION:');
  lines.push(txtLR('Added Time:', `+${session.added_minutes} minutes`));
  lines.push(txtLR('Extension Fee:', txtMoney(session.extension_fee)));
  lines.push(TXT_SEP);
  lines.push('UPDATED SESSION:');
  lines.push(txtLR('Total Time:', `${session.new_total_minutes} minutes`));
  lines.push(txtLR('Remaining:', `${session.remaining_minutes} minutes`));
  lines.push(TXT_DBL_SEP);
  lines.push(txtLR('PAID:', txtMoney(session.extension_fee)));
  if (session.cash_tendered) {
    lines.push(txtLR('Cash:', txtMoney(session.cash_tendered)));
    lines.push(txtLR('Change:', txtMoney(session.change_due || 0)));
  }
  lines.push(TXT_SEP);
  lines.push(txtCenter('Thank you for extending!'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Powered by Spavion'));
  lines.push(txtCenter('NOT AN OFFICIAL RECEIPT'));

  return lines.join('\n');
}

function buildPlainTextLibraryCheckout(session) {
  const cashierFirstName = getFirstName(session.cashier_name);
  const lines = [];
  lines.push(txtCenter('THE LIBRARY'));
  lines.push(txtCenter('Session Checkout'));
  lines.push(TXT_SEP);
  lines.push(txtLR('Date:', formatDateTime()));
  if (session.session_id) lines.push(txtLR('Session #:', 'LIB-' + String(session.session_id).padStart(6, '0')));
  lines.push(txtLR('Table:', String(session.table_number || '-')));
  lines.push(txtLR('Seat:', String(session.seat_number || '-')));
  lines.push(txtLR('Customer:', String(session.customer_name || '-')));
  if (cashierFirstName) lines.push(txtLR('Cashier:', cashierFirstName));
  lines.push(TXT_SEP);
  lines.push('SESSION SUMMARY:');
  lines.push(txtLR('Start:', session.start_time ? formatDateTime(session.start_time) : '-'));
  lines.push(txtLR('End:', session.end_time ? formatDateTime(session.end_time) : formatDateTime()));
  lines.push(txtLR('Used Time:', `${session.total_minutes || 0} mins`));
  lines.push(txtLR('Paid Time:', `${session.paid_minutes || 0} mins`));
  lines.push(TXT_DBL_SEP);
  lines.push(txtLR('TOTAL PAID:', txtMoney(session.amount_paid || 0)));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Thank you for studying with us!'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Powered by Spavion'));
  lines.push(txtCenter('NOT AN OFFICIAL RECEIPT'));

  return lines.join('\n');
}

// ============================================
// Refund Receipt Builders
// ============================================

function buildRefundReceiptHTML(data) {
  const transactionNum = 'ORD-' + String(data.transaction_id).padStart(6, '0');
  
  let itemsHTML = '';
  (data.items || []).forEach(item => {
    const itemName = item.item_name || item.name || 'Unknown Item';
    const qty = item.quantity || 1;
    const price = parseFloat(item.total_price || item.unit_price * qty || 0);
    
    itemsHTML += `<div class="item-row">`;
    itemsHTML += `<div class="item-name">${qty}x ${itemName}</div>`;
    itemsHTML += `<div class="item-price">${formatCurrency(price)}</div>`;
    itemsHTML += `</div>`;
  });

  return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="store-name">THE LIBRARY</div>
        <div class="store-sub">Coffee + Study</div>
        <div class="store-sub">Pavilion, Nunez St.</div>
        <div class="store-sub">Zamboanga City</div>
      </div>
      <div class="separator">${SEP}</div>
      <div style="text-align:center;font-size:14px;font-weight:bold;margin:6px 0;">*** REFUND RECEIPT ***</div>
      <div class="separator">${SEP}</div>
      <div class="info-row"><span>Date:</span><span>${formatDateTime(data.refunded_at || new Date())}</span></div>
      <div class="info-row"><span>Original Order:</span><span>${transactionNum}</span></div>
      <div class="info-row"><span>Beeper #:</span><span>${data.beeper_number || '-'}</span></div>
      <div class="info-row"><span>Original Date:</span><span>${formatDateTime(data.created_at)}</span></div>
      ${data.refunded_by ? `<div class="info-row"><span>Authorized By:</span><span>${escapeHtml(data.refunded_by)}</span></div>` : ''}
      <div class="separator">${SEP}</div>
      <div class="section-title">REFUNDED ITEMS:</div>
      ${itemsHTML}
      <div class="separator">${SEP}</div>
      <div class="totals">
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal || data.total_amount)}</span></div>
        ${data.discount_amount > 0 ? `<div class="row"><span>Discount${data.discount_name ? ` (${data.discount_name})` : ''}:</span><span>-${formatCurrency(data.discount_amount)}</span></div>` : ''}
        <div class="row total-final"><span>REFUND TOTAL:</span><span>${formatCurrency(data.total_amount)}</span></div>
      </div>
      <div class="separator">${SEP}</div>
      ${data.refund_reason ? `<div style="font-size:11px;"><strong>Reason:</strong> ${escapeHtml(data.refund_reason)}</div><div class="separator">${SEP}</div>` : ''}
      <div class="footer">
        <p>This is a refund confirmation.</p>
        <p>Please keep this for your records.</p>
        <p class="separator">${SEP}</p>
        <p>Powered by Spavion</p>
        <p style="margin-top:4px;">NOT AN OFFICIAL RECEIPT</p>
      </div>
    </div>
  `;
}

function buildPlainTextRefundReceipt(data) {
  const lines = [];
  lines.push(txtCenter('THE LIBRARY'));
  lines.push(txtCenter('Coffee + Study'));
  lines.push(txtCenter('Pavilion, Nunez St.'));
  lines.push(txtCenter('Zamboanga City'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('*** REFUND RECEIPT ***'));
  lines.push(TXT_SEP);
  lines.push(txtLR('Date:', formatDateTime(data.refunded_at || new Date())));
  lines.push(txtLR('Orig Order:', 'ORD-' + String(data.transaction_id).padStart(6, '0')));
  lines.push(txtLR('Beeper #:', String(data.beeper_number || '-')));
  lines.push(txtLR('Orig Date:', formatDateTime(data.created_at)));
  if (data.refunded_by) {
    lines.push(txtLR('Auth By:', data.refunded_by));
  }
  lines.push(TXT_SEP);
  lines.push('REFUNDED ITEMS:');
  
  (data.items || []).forEach(item => {
    const name = item.item_name || item.name || 'Item';
    const qty = item.quantity || 1;
    const price = parseFloat(item.total_price || item.unit_price * qty || 0);
    lines.push(txtLR(qty + 'x ' + name, txtMoney(price)));
  });
  
  lines.push(TXT_SEP);
  lines.push(txtLR('Subtotal:', txtMoney(data.subtotal || data.total_amount)));
  if (data.discount_amount > 0) {
    lines.push(txtLR('Discount:', '-' + txtMoney(data.discount_amount)));
  }
  lines.push(txtLR('REFUND TOTAL:', txtMoney(data.total_amount)));
  lines.push(TXT_SEP);
  
  if (data.refund_reason) {
    lines.push('Reason: ' + data.refund_reason);
    lines.push(TXT_SEP);
  }
  
  lines.push(txtCenter('Refund confirmation.'));
  lines.push(txtCenter('Keep for your records.'));
  lines.push(TXT_SEP);
  lines.push(txtCenter('Powered by Spavion'));
  lines.push(txtCenter('NOT AN OFFICIAL RECEIPT'));

  return lines.join('\n');
}

// ============================================
// Browser Print Fallback (window.print)
// Builds plain-text receipts that look structured on any thermal printer
// via Windows spooler. Used when localhost:9100 print server is offline.
// ============================================
function openThermalPrint(receiptData, printEndpoint) {
  // Build plain-text receipt based on the endpoint type
  let plainText = '';

  if (printEndpoint === '/library-checkin') {
    plainText = buildPlainTextLibraryCheckin(receiptData);
  } else if (printEndpoint === '/library-extension') {
    plainText = buildPlainTextLibraryExtension(receiptData);
  } else if (printEndpoint === '/library-checkout') {
    plainText = buildPlainTextLibraryCheckout(receiptData);
  } else if (printEndpoint === '/refund') {
    plainText = buildPlainTextRefundReceipt(receiptData);
  } else {
    // Order receipt — customer receipt + store receipt + barista + kitchen
    plainText = buildPlainTextCustomerReceipt(receiptData, 'CUSTOMER RECEIPT');
    plainText += '\n\n' + buildPlainTextCustomerReceipt(receiptData, 'STORE RECEIPT');
    const baristaText = buildPlainTextBaristaTicket(receiptData);
    if (baristaText) plainText += '\n\n' + baristaText;
    const kitchenText = buildPlainTextKitchenTicket(receiptData);
    if (kitchenText) plainText += '\n\n' + kitchenText;
  }

  // Escape HTML entities in plainText for safe embedding
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const printWindow = window.open('', '_blank', 'width=360,height=600');
  if (!printWindow || printWindow.closed) {
    alert('Popup blocked! Please allow popups for this site, then try again.');
    return;
  }

  const printDoc = `<!DOCTYPE html>
<html><head><title>Receipt</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Consolas', 'Lucida Console', monospace;
    font-size: 11px; line-height: 1.3; color: #000; background: #fff;
    width: 48mm; margin: 0 auto; padding: 2mm 1mm;
    white-space: pre; word-wrap: break-word;
  }
  @media print {
    @page { size: 58mm auto; margin: 0mm; }
    html, body { width: 58mm; margin: 0; padding: 1mm; }
  }
  @media screen { body { padding: 10px; width: 58mm; } }
</style></head>
<body>${escaped}</body></html>`;

  printWindow.document.write(printDoc);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    try { printWindow.print(); } catch (err) { console.error('Print failed:', err); }
    try {
      printWindow.onafterprint = () => {
        setTimeout(() => { try { printWindow.close(); } catch { /* ignore */ } }, 500);
      };
    } catch { /* ignore */ }
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 500);
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 300);
    setTimeout(triggerPrint, 2000);
  }
}

// ============================================
// Public API
// ============================================

/**
 * Show order receipt preview (customer + barista + kitchen tickets)
 */
export async function printOrderReceipt(receiptData) {
  let html = '';
  html += buildCustomerReceiptHTML(receiptData, 'CUSTOMER RECEIPT');
  html += buildCustomerReceiptHTML(receiptData, 'STORE RECEIPT');
  
  const baristaHTML = buildBaristaTicketHTML(receiptData);
  if (baristaHTML) html += baristaHTML;
  
  const kitchenHTML = buildKitchenTicketHTML(receiptData);
  if (kitchenHTML) html += kitchenHTML;
  
  return showReceiptModal(html, 'Order Receipt', receiptData, '/print', { autoPrint: true });
}

/**
 * Show customer receipt preview only (for reprints)
 */
export async function printCustomerReceipt(receiptData) {
  const html = buildCustomerReceiptHTML(receiptData, 'CUSTOMER RECEIPT') + buildCustomerReceiptHTML(receiptData, 'STORE RECEIPT');
  return showReceiptModal(html, 'Customer Receipt', receiptData);
}

/**
 * Show library check-in receipt preview
 */
export async function printLibraryCheckinReceipt(session) {
  const html = buildLibraryCheckinReceiptHTML(session);
  return showReceiptModal(html, 'Check-in Receipt', session, '/library-checkin');
}

/**
 * Show library extension receipt preview
 */
export async function printLibraryExtensionReceipt(session) {
  const html = buildLibraryExtensionReceiptHTML(session);
  return showReceiptModal(html, 'Extension Receipt', session, '/library-extension');
}

/**
 * Show library checkout receipt preview
 */
export async function printLibraryCheckoutReceipt(session) {
  const html = buildLibraryCheckoutReceiptHTML(session);
  return showReceiptModal(html, 'Checkout Receipt', session, '/library-checkout', { autoPrint: true });
}

/**
 * Show refund receipt preview
 */
export async function printRefundReceipt(refundData) {
  const html = buildRefundReceiptHTML(refundData);
  return showReceiptModal(html, 'Refund Receipt', refundData, '/refund');
}

export default {
  printOrderReceipt,
  printCustomerReceipt,
  printLibraryCheckinReceipt,
  printLibraryExtensionReceipt,
  printLibraryCheckoutReceipt,
  printRefundReceipt
};
