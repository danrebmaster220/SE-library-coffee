const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // React app URL
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Import Database Connection
const db = require('./config/db');

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

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: "Welcome to Library Coffee + Study API" });
});

// Test Database Route
app.get('/test-db', async (req, res) => {
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


// SOCKET.IO REAL-TIME EVENTS

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join specific rooms
    socket.on('join:pos', () => {
        socket.join('pos-room');
        console.log('Client joined POS room');
    });

    socket.on('join:library', () => {
        socket.join('library-room');
        console.log('Client joined Library room');
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

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Make io accessible to routes (optional, for emitting from controllers)
app.set('io', io);


// START SERVER

server.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO is ready for connections`);
});