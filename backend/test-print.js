const usb = require('usb');

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

// Find the printer (VID: 0x0483, PID: 0x5743)
const VID = 0x0483;
const PID = 0x5743;

console.log('Looking for printer...');

const device = usb.findByIds(VID, PID);

if (!device) {
    console.log('Printer not found! Available devices:');
    usb.getDeviceList().forEach(d => {
        console.log(`  VID: 0x${d.deviceDescriptor.idVendor.toString(16)}, PID: 0x${d.deviceDescriptor.idProduct.toString(16)}`);
    });
    process.exit(1);
}

console.log('Printer found! Opening...');

try {
    device.open();
    
    const iface = device.interface(0);
    
    // Detach kernel driver if needed (Linux/Mac)
    if (iface.isKernelDriverActive()) {
        iface.detachKernelDriver();
    }
    
    iface.claim();
    
    // Find the OUT endpoint
    const outEndpoint = iface.endpoints.find(ep => ep.direction === 'out');
    
    if (!outEndpoint) {
        console.log('No OUT endpoint found!');
        device.close();
        process.exit(1);
    }
    
    console.log('Sending test print...');
    
    // Build the print data
    const data = Buffer.from([
        ESC, 0x40,           // Initialize printer
        ESC, 0x61, 0x01,     // Center align
        GS, 0x21, 0x30,      // Double size
        ...Buffer.from('TEST PRINT\n'),
        GS, 0x21, 0x00,      // Normal size
        ...Buffer.from('--------------------------------\n'),
        ...Buffer.from('JK-5802H Working!\n'),
        ...Buffer.from('The Library Coffee POS\n'),
        ...Buffer.from('--------------------------------\n'),
        ESC, 0x64, 0x03,     // Feed 3 lines
        GS, 0x56, 0x00       // Cut paper
    ]);
    
    outEndpoint.transfer(data, (err) => {
        if (err) {
            console.log('Print error:', err.message);
        } else {
            console.log('Print sent successfully!');
        }
        
        iface.release(() => {
            device.close();
            process.exit(0);
        });
    });
    
} catch (error) {
    console.log('Error:', error.message);
    try { device.close(); } catch(e) {}
    process.exit(1);
}
