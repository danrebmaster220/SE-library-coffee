/**
 * Direct USB Print Test - WinUSB Version
 * Uses the 'usb' package to communicate directly with the thermal printer
 * Run this AFTER installing WinUSB driver via Zadig
 */

const usb = require('usb');

// JK-5802H Printer USB IDs
const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x5743;

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

function buildTestReceipt() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH');
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    
    const commands = [];
    
    // Initialize printer
    commands.push(ESC, 0x40);
    
    // Center align
    commands.push(ESC, 0x61, 0x01);
    
    // Double size + Bold
    commands.push(GS, 0x21, 0x11);
    commands.push(ESC, 0x45, 0x01);
    
    // Title
    const title = 'THE LIBRARY\n';
    for (let i = 0; i < title.length; i++) commands.push(title.charCodeAt(i));
    
    // Normal size, no bold
    commands.push(GS, 0x21, 0x00);
    commands.push(ESC, 0x45, 0x00);
    
    const subtitle = 'Coffee + Study Hub\n';
    for (let i = 0; i < subtitle.length; i++) commands.push(subtitle.charCodeAt(i));
    
    const sep = '================================\n';
    for (let i = 0; i < sep.length; i++) commands.push(sep.charCodeAt(i));
    
    // Left align
    commands.push(ESC, 0x61, 0x00);
    
    const dateTime = `Date: ${dateStr}  Time: ${timeStr}\n`;
    for (let i = 0; i < dateTime.length; i++) commands.push(dateTime.charCodeAt(i));
    
    for (let i = 0; i < sep.length; i++) commands.push(sep.charCodeAt(i));
    
    // Bold for test message
    commands.push(ESC, 0x45, 0x01);
    const testMsg = 'TEST PRINT SUCCESS!\n';
    for (let i = 0; i < testMsg.length; i++) commands.push(testMsg.charCodeAt(i));
    commands.push(ESC, 0x45, 0x00);
    
    const item1 = '1x Caffe Latte           P120.00\n';
    for (let i = 0; i < item1.length; i++) commands.push(item1.charCodeAt(i));
    
    const item2 = '1x Croissant              P85.00\n';
    for (let i = 0; i < item2.length; i++) commands.push(item2.charCodeAt(i));
    
    const sep2 = '--------------------------------\n';
    for (let i = 0; i < sep2.length; i++) commands.push(sep2.charCodeAt(i));
    
    commands.push(ESC, 0x45, 0x01);
    const total = 'TOTAL                    P205.00\n';
    for (let i = 0; i < total.length; i++) commands.push(total.charCodeAt(i));
    commands.push(ESC, 0x45, 0x00);
    
    for (let i = 0; i < sep.length; i++) commands.push(sep.charCodeAt(i));
    
    // Center for footer
    commands.push(ESC, 0x61, 0x01);
    
    const footer1 = 'Thank you for visiting!\n';
    for (let i = 0; i < footer1.length; i++) commands.push(footer1.charCodeAt(i));
    
    const footer2 = 'See you again!\n';
    for (let i = 0; i < footer2.length; i++) commands.push(footer2.charCodeAt(i));
    
    // Feed lines
    commands.push(ESC, 0x64, 0x04);
    
    // Cut paper
    commands.push(GS, 0x56, 0x00);
    
    return Buffer.from(commands);
}

async function printTest() {
    console.log('=== Direct USB Print Test (WinUSB) ===\n');
    console.log('Looking for printer...');
    
    const devices = usb.getDeviceList();
    const printer = devices.find(d => 
        d.deviceDescriptor.idVendor === VENDOR_ID && 
        d.deviceDescriptor.idProduct === PRODUCT_ID
    );
    
    if (!printer) {
        console.log('❌ Printer not found!');
        return;
    }
    
    console.log('✅ Printer found!');
    console.log(`   VID: 0x${VENDOR_ID.toString(16)}, PID: 0x${PRODUCT_ID.toString(16)}`);
    
    try {
        printer.open();
        console.log('✅ Device opened');
        
        const iface = printer.interface(0);
        
        // Claim the interface
        try {
            iface.claim();
            console.log('✅ Interface claimed');
        } catch (e) {
            console.log('⚠️ Interface claim:', e.message);
        }
        
        // Find OUT endpoint
        let outEndpoint = null;
        console.log('\nEndpoints:');
        for (const ep of iface.endpoints) {
            console.log(`   0x${ep.address.toString(16).padStart(2, '0')} - ${ep.direction} (${ep.transferType})`);
            if (ep.direction === 'out') {
                outEndpoint = ep;
            }
        }
        
        if (!outEndpoint) {
            console.log('\n❌ No OUT endpoint found');
            printer.close();
            return;
        }
        
        console.log(`\n✅ Using OUT endpoint: 0x${outEndpoint.address.toString(16)}`);
        console.log('Sending test receipt...');
        
        const receiptData = buildTestReceipt();
        console.log(`   Data size: ${receiptData.length} bytes`);
        
        outEndpoint.transfer(receiptData, (error) => {
            if (error) {
                console.log('❌ Print error:', error.message);
            } else {
                console.log('\n✅ ✅ ✅ Receipt sent successfully! ✅ ✅ ✅');
                console.log('\n🖨️  Check your printer for output!');
            }
            
            try {
                iface.release(true, () => {
                    printer.close();
                    console.log('\n✅ Device closed');
                    process.exit(0);
                });
            } catch (e) {
                printer.close();
                process.exit(0);
            }
        });
        
    } catch (error) {
        console.log('❌ Error:', error.message);
        try { printer.close(); } catch(e) {}
    }
}

printTest();
