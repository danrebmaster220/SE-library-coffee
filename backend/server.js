const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables FIRST
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Parse CORS origins from environment variable
const getAllowedOrigins = () => {
    const origins = process.env.CORS_ORIGINS || 'http://localhost:5173';
    return origins.split(',').map(origin => origin.trim());
};

const allowedOrigins = getAllowedOrigins();

console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🔗 Allowed CORS origins: ${allowedOrigins.join(', ')}`);

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO with dynamic CORS
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
});

// CORS middleware with dynamic origins
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            callback(null, true); // In development, allow anyway but warn
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Import Database Connection
const db = require('./config/db');
const runMigrations = require('./config/migrations');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const discountRoutes = require('./routes/discountRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const userRoutes = require('./routes/userRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const printerRoutes = require('./routes/printerRoutes');
const customizationRoutes = require('./routes/customizationRoutes');
const posRoutes = require('./routes/posRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const { verifySocketToken } = require('./middleware/auth');

// Basic Route
app.get('/', (req, res) => {
    res.json({ 
        message: "Welcome to Library Coffee + Study API",
        version: "1.0.0",
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Health Check Endpoint (for hosting platforms like Railway, Render, etc.)
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await db.query('SELECT 1');
        res.status(200).json({ 
            status: 'healthy',
            database: 'connected',
            environment: NODE_ENV,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test Database Route (development only)
app.get('/test-db', async (req, res) => {
    if (NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not available in production' });
    }
    try {
        const [rows] = await db.query(`
            SELECT u.user_id, u.username, u.full_name, r.role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.role_id
            LIMIT 5
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TEMPORARY DB ID FIX SCRIPT ROUTE - Hit this URL once in the browser to fix jumping TiDB IDs
app.get('/api/fix-tidb-ids', async (req, res) => {
    try {
        const fixScript = require('./scripts/fix_jumping_ids');
        await fixScript();
        res.json({ message: '🎉 ID Resequencing Complete! Check Render logs for details.' });
    } catch (error) {
        console.error('API Error running fix script:', error);
        res.status(500).json({ error: error.message });
    }
});


// REGISTER ROUTES

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/customizations', customizationRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/shifts', shiftRoutes);


// SOCKET.IO REAL-TIME EVENTS

// Track connected print agents
const printAgents = new Map();

// Track locked library seats
const lockedSeats = new Map();
app.set('lockedSeats', lockedSeats);

const AUTHENTICATED_ROOM = 'authenticated-users';

// Socket auth middleware: validates token when provided, but keeps anonymous clients
// for kiosk/printing channels that do not use JWT auth.
io.use((socket, next) => {
    const tokenFromAuth = socket.handshake?.auth?.token;
    const tokenFromHeader = socket.handshake?.headers?.authorization;
    const tokenFromQuery = socket.handshake?.query?.token;

    const decodedUser = verifySocketToken(tokenFromAuth || tokenFromHeader || tokenFromQuery);
    socket.data.user = decodedUser || null;
    next();
});

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    if (socket.data?.user) {
        socket.join(AUTHENTICATED_ROOM);
        console.log(`🔐 Authenticated socket: ${socket.id}`);
    }

    // Join specific rooms
    socket.on('join:pos', () => {
        socket.join('pos-room');
        console.log('Client joined POS room');
    });

    socket.on('join:library', () => {
        socket.join('library-room');
        console.log('Client joined Library room');
    });

    // ═══════════════════════════════════════════════════════════════
    // PRINT AGENT EVENTS (for cloud deployment with local printing)
    // ═══════════════════════════════════════════════════════════════
    
    socket.on('register-print-agent', (data) => {
        printAgents.set(socket.id, {
            location: data.location,
            capabilities: data.capabilities,
            printerName: data.printerName,
            connectedAt: new Date(),
        });
        socket.join('print-agents');
        console.log(`🖨️ Print Agent registered: ${data.location} (${data.printerName})`);
        
        // Notify POS clients that a printer is available
        io.to('pos-room').emit('printer:status', { 
            available: true, 
            location: data.location 
        });
    });
    
    socket.on('print-job-complete', (data) => {
        console.log(`📄 Print job ${data.jobId} ${data.success ? 'completed' : 'failed'}`);
        // Notify the POS about print status
        io.to('pos-room').emit('print:result', data);
    });

    // Order events
    socket.on('order:new', (data) => {
        console.log('New order:', data);
        io.to('pos-room').emit('order:queue-update', data);
    });

    socket.on('order:status-change', (data) => {
        console.log('Order status changed:', data);
        io.to('pos-room').emit('order:queue-update', data);
    });

    socket.on('order:payment', (data) => {
        console.log('Order paid:', data);
        io.to('pos-room').emit('order:queue-update', data);
    });

    // Beeper events - broadcast to all clients when beeper status changes
    socket.on('beeper:status-change', (data) => {
        console.log('Beeper status changed:', data);
        io.emit('beepers:update', data); // Broadcast to ALL clients (POS + Kiosk)
    });

    // Library seat events
    socket.on('library:checkin', (data) => {
        console.log('Library check-in:', data);
        io.to('library-room').emit('library:seats-update', data);
    });

    socket.on('library:checkout', (data) => {
        console.log('Library checkout:', data);
        io.to('library-room').emit('library:seats-update', data);
    });

    // Transient Seat Locks for Kiosk Concurrency
    const SEAT_LOCK_DURATION = 3 * 60 * 1000; // 3 minutes lock

    socket.on('seat:lock', (data) => {
        const { seat_id } = data;
        const now = Date.now();
        
        // Check if already locked by someone else
        if (lockedSeats.has(seat_id)) {
            const lockInfo = lockedSeats.get(seat_id);
            if (lockInfo.socketId !== socket.id && lockInfo.expiresAt > now) {
                // Deny lock, already locked by another active session
                socket.emit('seat:lock-failed', { seat_id, message: 'Seat is currently reserved by another customer' });
                return;
            }
        }
        
        // Grant lock
        lockedSeats.set(seat_id, {
            socketId: socket.id,
            expiresAt: now + SEAT_LOCK_DURATION
        });
        
        console.log(`🔒 Seat ${seat_id} locked by socket ${socket.id}`);
        // Broadcast lock to all clients so they instantly mark it yellow/red
        io.emit('seat:locked', { seat_id, lockedBy: socket.id });
    });

    socket.on('seat:release', (data) => {
        const { seat_id } = data;
        
        if (lockedSeats.has(seat_id)) {
            const lockInfo = lockedSeats.get(seat_id);
            // Only the one who locked it (or an expired lock) can release it
            if (lockInfo.socketId === socket.id || lockInfo.expiresAt <= Date.now()) {
                lockedSeats.delete(seat_id);
                console.log(`🔓 Seat ${seat_id} released by socket ${socket.id}`);
                io.emit('seat:released', { seat_id });
            }
        }
    });

    socket.on('disconnect', () => {
        // Automatically release any seats locked by this disconnected client
        const seatsToRelease = [];
        for (const [seat_id, lockInfo] of lockedSeats.entries()) {
            if (lockInfo.socketId === socket.id) {
                seatsToRelease.push(seat_id);
                lockedSeats.delete(seat_id);
            }
        }
        
        if (seatsToRelease.length > 0) {
            console.log(`🔓 Auto-released seats on disconnect: ${seatsToRelease.join(', ')}`);
            seatsToRelease.forEach(seat_id => {
                io.emit('seat:released', { seat_id });
            });
        }
        // Check if this was a print agent
        if (printAgents.has(socket.id)) {
            const agent = printAgents.get(socket.id);
            console.log(`🖨️ Print Agent disconnected: ${agent.location}`);
            printAgents.delete(socket.id);
            
            // Notify POS if no print agents remaining
            if (printAgents.size === 0) {
                io.to('pos-room').emit('printer:status', { available: false });
            }
        }
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Helper function to send print job to agents (used by controllers)
const sendPrintJob = (type, data) => {
    if (printAgents.size === 0) {
        console.log('⚠️ No print agents connected, skipping print job');
        return false;
    }
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    io.to('print-agents').emit(type, { ...data, jobId });
    console.log(`📤 Print job sent: ${type} (${jobId})`);
    return jobId;
};

// Make print function accessible to routes
app.set('sendPrintJob', sendPrintJob);
app.set('printAgents', printAgents);

// Make io and lockedSeats accessible to routes (optional, for emitting from controllers)
app.set('io', io);
app.set('lockedSeats', lockedSeats);


// START SERVER — Run migrations first, then listen
runMigrations().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        🚀 Library Coffee + Study API Server                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Status:      Running                                    ║`);
    console.log(`║  🌍 Environment: ${NODE_ENV.padEnd(41)}║`);
    console.log(`║  🔗 Port:        ${String(PORT).padEnd(41)}║`);
    console.log(`║  📡 Socket.IO:   Ready                                      ║`);
    console.log(`║  💾 Health:      http://localhost:${PORT}/health`.padEnd(62) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    });
});