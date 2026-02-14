/**
 * Print Agent - Local Windows Service
 * 
 * This agent runs on the Windows PC with the printer attached.
 * It connects to the cloud backend via WebSocket and receives print jobs.
 * 
 * Usage:
 *   1. Update CLOUD_BACKEND_URL to your Render URL
 *   2. Run: node index.js
 *   3. Keep it running while the shop is open
 */

require('dotenv').config({ path: '../.env' });
const { io } = require('socket.io-client');
const path = require('path');

// Import the existing printer service
const printerService = require('../services/printerService');

// Configuration
const CONFIG = {
    // Change this to your Render URL when deployed
    cloudBackendUrl: process.env.PRINT_AGENT_SERVER || 'http://localhost:3000',
    
    // Printer location identifier (useful for multiple locations)
    printerLocation: process.env.PRINTER_LOCATION || 'main-counter',
    
    // Reconnection settings
    reconnectAttempts: Infinity,
    reconnectDelay: 3000,
};

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           🖨️  Library Coffee Print Agent                   ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║  Server:   ${CONFIG.cloudBackendUrl.padEnd(43)}║`);
console.log(`║  Location: ${CONFIG.printerLocation.padEnd(43)}║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Connect to cloud backend
const socket = io(CONFIG.cloudBackendUrl, {
    reconnection: true,
    reconnectionAttempts: CONFIG.reconnectAttempts,
    reconnectionDelay: CONFIG.reconnectDelay,
    transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
    console.log('✅ Connected to cloud backend');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Register this print agent with the server
    socket.emit('register-print-agent', {
        location: CONFIG.printerLocation,
        capabilities: ['receipt', 'barista-ticket', 'library-receipt'],
        printerName: process.env.PRINTER_NAME || 'JK-5802H',
    });
});

socket.on('disconnect', (reason) => {
    console.log(`⚠️ Disconnected from cloud backend: ${reason}`);
    console.log('   Attempting to reconnect...');
});

socket.on('connect_error', (error) => {
    console.log(`❌ Connection error: ${error.message}`);
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_attempt', (attemptNumber) => {
    if (attemptNumber % 10 === 0) {
        console.log(`   Reconnection attempt #${attemptNumber}...`);
    }
});

// Print job handlers
socket.on('print-customer-receipt', async (data) => {
    console.log(`📄 Received customer receipt job for Order #${data.order?.beeper_number || 'N/A'}`);
    
    try {
        await printerService.printOrderReceipts(data.order);
        console.log('   ✅ Customer receipt printed successfully');
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'customer-receipt',
            orderId: data.order?.id,
            success: true,
        });
    } catch (error) {
        console.log(`   ❌ Print failed: ${error.message}`);
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'customer-receipt',
            orderId: data.order?.id,
            success: false,
            error: error.message,
        });
    }
});

socket.on('print-barista-ticket', async (data) => {
    console.log(`🎫 Received barista ticket job for Order #${data.order?.beeper_number || 'N/A'}`);
    
    try {
        await printerService.printBaristaTicket(data.order);
        console.log('   ✅ Barista ticket printed successfully');
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'barista-ticket',
            orderId: data.order?.id,
            success: true,
        });
    } catch (error) {
        console.log(`   ❌ Print failed: ${error.message}`);
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'barista-ticket',
            orderId: data.order?.id,
            success: false,
            error: error.message,
        });
    }
});

socket.on('print-library-receipt', async (data) => {
    console.log(`📚 Received library receipt job for Session #${data.session?.id || 'N/A'}`);
    
    try {
        if (data.type === 'checkin') {
            await printerService.printLibraryCheckinReceipt(data.session);
        } else if (data.type === 'extension') {
            await printerService.printLibraryExtensionReceipt(data.session);
        } else if (data.type === 'checkout') {
            await printerService.printLibraryCheckoutReceipt(data.session);
        } else {
            await printerService.printLibraryReceipt(data.session);
        }
        console.log('   ✅ Library receipt printed successfully');
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'library-receipt',
            sessionId: data.session?.id,
            success: true,
        });
    } catch (error) {
        console.log(`   ❌ Print failed: ${error.message}`);
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'library-receipt',
            sessionId: data.session?.id,
            success: false,
            error: error.message,
        });
    }
});

// Test print command (for debugging)
socket.on('test-print', async (data) => {
    console.log('🧪 Received test print request');
    
    try {
        await printerService.testPrint();
        console.log('   ✅ Test print successful');
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'test',
            success: true,
        });
    } catch (error) {
        console.log(`   ❌ Test print failed: ${error.message}`);
        
        socket.emit('print-job-complete', {
            jobId: data.jobId,
            type: 'test',
            success: false,
            error: error.message,
        });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Print Agent...');
    socket.disconnect();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Print Agent...');
    socket.disconnect();
    process.exit(0);
});

// Keep the process running
console.log('🖨️ Print Agent is running. Press Ctrl+C to stop.\n');
