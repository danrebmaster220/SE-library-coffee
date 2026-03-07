/**
 * Local Print Server for POS-58 Thermal Printer
 * 
 * This tiny server runs on the LOCAL machine (your laptop) and acts as a bridge
 * between the cloud-hosted web app and the USB-connected POS-58 printer.
 * 
 * How it works:
 * 1. Web app (Vercel) sends receipt text to http://localhost:9100/print
 * 2. This server receives it and sends it to the POS-58 via Windows print spooler
 * 3. The POS-58 prints the receipt
 * 
 * Usage: node server.js
 * Or:    npm start (from the print-server folder)
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9100;
const PRINTER_NAME = process.env.PRINTER_NAME || 'POS-58';
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  BOLD_ON: ESC + 'E\x01',
  BOLD_OFF: ESC + 'E\x00',
  DOUBLE_SIZE: GS + '!\x30',
  NORMAL_SIZE: GS + '!\x00',
  FEED: (n) => ESC + 'd' + String.fromCharCode(n),
  CUT: GS + 'V\x01',
};

const LINE = '--------------------------------';
const W = 32; // characters per line

function center(text) {
  const pad = Math.floor((W - text.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + text;
}

function leftRight(left, right) {
  const space = W - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right;
}

function currency(amount) {
  return 'P' + parseFloat(amount || 0).toFixed(2);
}

function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleString('en-PH', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

/**
 * Build ESC/POS receipt from JSON data
 */
function buildReceipt(data) {
  let r = '';
  r += CMD.INIT;

  // Header
  r += CMD.ALIGN_CENTER;
  r += CMD.BOLD_ON;
  r += CMD.DOUBLE_SIZE;
  r += 'THE LIBRARY\n';
  r += CMD.NORMAL_SIZE;
  r += 'Coffee + Study\n';
  r += CMD.BOLD_OFF;
  r += 'Pavilion, Nunez St.\n';
  r += 'Zamboanga City\n';

  // Separator
  r += CMD.ALIGN_LEFT;
  r += LINE + '\n';

  // Info
  const txnNum = 'ORD-' + String(data.transaction_id || 0).padStart(6, '0');
  r += leftRight('Date:', formatDate(data.created_at)) + '\n';
  r += leftRight('Txn #:', txnNum) + '\n';
  r += leftRight('Order #:', String(data.beeper_number || '')) + '\n';
  if (data.cashier_name) {
    r += leftRight('Cashier:', data.cashier_name) + '\n';
  }
  r += LINE + '\n';

  // Items
  r += CMD.BOLD_ON;
  r += 'ITEMS:\n';
  r += CMD.BOLD_OFF;

  (data.items || []).forEach(item => {
    const name = item.name || item.item_name || 'Item';
    const qty = item.quantity || 1;
    const price = parseFloat(item.unit_price || 0);
    const total = price * qty;

    r += CMD.BOLD_ON;
    r += `${qty}x ${name}\n`;
    r += CMD.BOLD_OFF;

    // Customizations
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach(c => {
        const cName = c.option_name || c.name || '';
        const cPrice = parseFloat(c.total_price || c.unit_price || 0);
        if (cPrice > 0) {
          r += `  + ${cName} (+${currency(cPrice)})\n`;
        } else if (cName) {
          r += `  [${cName}]\n`;
        }
      });
    }

    r += `  @ ${currency(price)} = ${currency(total)}\n`;
  });

  r += LINE + '\n';

  // Library booking
  if (data.library_booking) {
    const lb = data.library_booking;
    r += CMD.BOLD_ON;
    r += 'STUDY AREA BOOKING:\n';
    r += CMD.BOLD_OFF;
    r += `Table ${lb.table_number}, Seat ${lb.seat_number}\n`;
    const hrs = Math.floor(lb.duration_minutes / 60);
    const mins = lb.duration_minutes % 60;
    r += `Duration: ${hrs}h${mins > 0 ? ` ${mins}m` : ''}\n`;
    r += leftRight('Study Area:', currency(lb.amount)) + '\n';
    r += LINE + '\n';
  }

  // Totals
  r += leftRight('Subtotal:', currency(data.subtotal)) + '\n';
  if (parseFloat(data.discount_amount) > 0) {
    const discLabel = data.discount_name ? `Discount (${data.discount_name}):` : 'Discount:';
    r += leftRight(discLabel, '-' + currency(data.discount_amount)) + '\n';
  }
  r += LINE.replace(/-/g, '=') + '\n';
  r += CMD.BOLD_ON;
  r += CMD.DOUBLE_SIZE;
  r += leftRight('TOTAL:', currency(data.total_amount)) + '\n';
  r += CMD.NORMAL_SIZE;
  r += CMD.BOLD_OFF;

  if (data.cash_tendered) {
    r += leftRight('Cash:', currency(data.cash_tendered)) + '\n';
    r += leftRight('Change:', currency(data.change_due)) + '\n';
  }

  r += LINE + '\n';

  // Footer
  r += CMD.ALIGN_CENTER;
  r += 'Thank you for visiting!\n';
  r += 'Please wait for your order\n';
  r += 'number to be called.\n';
  r += LINE + '\n';
  r += 'NOT AN OFFICIAL RECEIPT\n';

  // Feed and cut
  r += CMD.FEED(4);
  r += CMD.CUT;

  return r;
}

/**
 * Send raw data to printer via PowerShell Out-Printer
 */
function printRaw(data) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(TEMP_DIR, `receipt_${Date.now()}.txt`);
    
    // Write receipt text to temp file (strip ESC/POS commands for Out-Printer)
    // Out-Printer sends text through the Windows GDI print pipeline
    const cleanText = data
      .replace(/\x1B[@aE\-]/g, '')       // strip ESC commands
      .replace(/\x1B[^\n]{1,2}/g, '')     // strip ESC sequences
      .replace(/\x1D[^\n]{1,2}/g, '')     // strip GS sequences
      .replace(/[\x00-\x09\x0E-\x1F]/g, ''); // strip control chars except \n \r
    
    fs.writeFileSync(tempFile, cleanText, 'utf8');
    
    // Use Out-Printer to send to the POS-58
    const cmd = `powershell -ExecutionPolicy Bypass -Command "Get-Content -Path '${tempFile.replace(/'/g, "''")}' -Raw | Out-Printer -Name '${PRINTER_NAME}'"`;
    
    exec(cmd, (error, stdout, stderr) => {
      // Cleanup temp file
      try { setTimeout(() => fs.unlinkSync(tempFile), 2000); } catch(e) {}
      
      if (error) {
        console.error('Print error:', error.message);
        reject(new Error('Print failed: ' + error.message));
      } else {
        console.log('[' + new Date().toLocaleTimeString() + '] Receipt printed successfully');
        resolve(true);
      }
    });
  });
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  // CORS headers — allow the hosted web app to call this local server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', printer: PRINTER_NAME }));
    return;
  }

  // Print receipt
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const receipt = buildReceipt(data);
        await printRaw(receipt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Printed!' }));
      } catch (err) {
        console.error('Print error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Test print
  if (req.method === 'POST' && req.url === '/test') {
    try {
      let testText = '';
      testText += center('PRINTER TEST') + '\n';
      testText += LINE + '\n';
      testText += `Date: ${formatDate()}\n`;
      testText += 'POS-58 Connected!\n';
      testText += 'Print Server Working!\n';
      testText += LINE + '\n';
      testText += '\n\n\n';

      await printRaw(testText);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Test print sent!' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Catch uncaught errors so the server doesn't silently exit
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('ERROR: Port ' + PORT + ' is already in use.');
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ==========================================');
  console.log('  |   POS-58 Local Print Server            |');
  console.log('  |   Running on http://localhost:' + PORT + '      |');
  console.log('  |   Printer: ' + PRINTER_NAME.padEnd(28) + '|');
  console.log('  |   Ready to receive print jobs!         |');
  console.log('  ==========================================');
  console.log('');
  console.log('  Keep this window open while using the POS.');
  console.log('');
});
