/**
 * Windows Print Test - Using Windows Print Spooler
 * This approach uses the Windows print system instead of direct USB
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const DOUBLE_SIZE = GS + '!' + '\x11';
const NORMAL_SIZE = GS + '!' + '\x00';
const CUT = GS + 'V' + '\x00';
const FEED = ESC + 'd' + '\x03';

// Build test receipt
function buildTestReceipt() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH');
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    
    let receipt = '';
    
    // Initialize printer
    receipt += INIT;
    
    // Header
    receipt += ALIGN_CENTER;
    receipt += DOUBLE_SIZE;
    receipt += BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += NORMAL_SIZE;
    receipt += BOLD_OFF;
    receipt += 'Coffee + Study Hub\n';
    receipt += '================================\n';
    
    // Date/Time
    receipt += ALIGN_LEFT;
    receipt += `Date: ${dateStr}  Time: ${timeStr}\n`;
    receipt += '================================\n';
    
    // Test items
    receipt += BOLD_ON;
    receipt += 'TEST PRINT\n';
    receipt += BOLD_OFF;
    receipt += '1x Caffe Latte           P120.00\n';
    receipt += '1x Croissant              P85.00\n';
    receipt += '--------------------------------\n';
    receipt += BOLD_ON;
    receipt += 'TOTAL                    P205.00\n';
    receipt += BOLD_OFF;
    
    receipt += '================================\n';
    receipt += ALIGN_CENTER;
    receipt += 'Thank you for visiting!\n';
    receipt += 'See you again!\n';
    receipt += '\n\n\n';
    
    // Cut paper
    receipt += FEED;
    receipt += CUT;
    
    return receipt;
}

// Method 1: Write to file and use Windows PRINT command
async function printViaWindowsSpooler(printerName = 'POS-58') {
    console.log(`Attempting to print via Windows spooler to: ${printerName}`);
    
    const receipt = buildTestReceipt();
    const tempFile = path.join(__dirname, 'temp_receipt.bin');
    
    // Write binary data to temp file
    fs.writeFileSync(tempFile, receipt, 'binary');
    console.log('Temp file created:', tempFile);
    
    // Use Windows COPY command to send raw data to printer
    const command = `copy /b "${tempFile}" "\\\\%COMPUTERNAME%\\${printerName}"`;
    
    console.log('Executing:', command);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('Print error:', error.message);
            // Try alternative method
            tryRawPrint(tempFile, printerName);
        } else {
            console.log('Print command executed!');
            console.log('stdout:', stdout);
            if (stderr) console.log('stderr:', stderr);
            // Clean up
            setTimeout(() => {
                try { fs.unlinkSync(tempFile); } catch(e) {}
            }, 2000);
        }
    });
}

// Method 2: Direct file output to USB port
function tryRawPrint(tempFile, printerName) {
    console.log('\nTrying direct USB port output...');
    
    // Try writing directly to USB port
    const ports = ['USB001', 'USB002', 'USB003', 'LPT1'];
    
    for (const port of ports) {
        console.log(`Trying port: ${port}`);
        const portPath = `\\\\.\\${port}`;
        
        try {
            const receipt = fs.readFileSync(tempFile);
            fs.writeFileSync(portPath, receipt);
            console.log(`Successfully wrote to ${port}!`);
            return;
        } catch (e) {
            console.log(`  Failed: ${e.message}`);
        }
    }
    
    console.log('\n--- Alternative: Try printing via notepad ---');
    console.log('Command: notepad /p temp_receipt.bin');
    
    // As a fallback, create a text version
    createTextReceipt();
}

// Method 3: Create plain text receipt for manual printing
function createTextReceipt() {
    console.log('\nCreating plain text receipt for manual printing...');
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH');
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    
    const text = `
================================
        THE LIBRARY
     Coffee + Study Hub
================================
Date: ${dateStr}  Time: ${timeStr}
================================
TEST PRINT

1x Caffe Latte           P120.00
1x Croissant              P85.00
--------------------------------
TOTAL                    P205.00
================================
    Thank you for visiting!
       See you again!
================================




`;
    
    const textFile = path.join(__dirname, 'test_receipt.txt');
    fs.writeFileSync(textFile, text);
    console.log('Text receipt saved to:', textFile);
    console.log('\nYou can manually print this file to test the printer.');
}

// Run the test
console.log('=== Windows Print Test ===\n');
printViaWindowsSpooler('POS-58');
