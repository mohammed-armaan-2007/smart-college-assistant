const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

async function startServer() {
    // Initialize database (async for sql.js)
    await initializeDatabase();

    // API Routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/events', require('./routes/events'));
    app.use('/api/holidays', require('./routes/holidays'));
    app.use('/api/exams', require('./routes/exams'));
    app.use('/api/announcements', require('./routes/announcements'));
    app.use('/api/courses', require('./routes/courses'));
    app.use('/api', require('./routes/admin'));

    // Serve frontend pages
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    });

    app.get('/student', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'student.html'));
    });

    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
    });

    // Catch-all
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
        }
    });

    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║      🎓 Smart College Assistant Server 🎓       ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Server running at: http://localhost:${PORT}        ║
║                                                  ║
║  Demo Credentials:                               ║
║  ─────────────────                               ║
║  Admin:   admin / admin123                       ║
║  Student: student1 / student123                  ║
║                                                  ║
║  API Base: http://localhost:${PORT}/api             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
