const express = require('express');
const { dbPrepare } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    try {
        const { category, upcoming, featured, limit } = req.query;
        let query = 'SELECT * FROM events WHERE 1=1';
        const params = [];
        if (category) { query += ' AND category = ?'; params.push(category); }
        if (upcoming === 'true') { query += ' AND event_date >= date("now")'; }
        if (featured === 'true') { query += ' AND is_featured = 1'; }
        query += ' ORDER BY event_date ASC';
        if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, (req, res) => {
    try {
        const event = dbPrepare('SELECT * FROM events WHERE id = ?').get(parseInt(req.params.id));
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, description, event_date, event_time, end_date, location, category, is_featured } = req.body;
        const result = dbPrepare(
            'INSERT INTO events (title, description, event_date, event_time, end_date, location, category, is_featured, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(title, description, event_date, event_time, end_date, location, category || 'general', is_featured || 0, req.user.id);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Event created successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, description, event_date, event_time, end_date, location, category, is_featured } = req.body;
        dbPrepare('UPDATE events SET title=?, description=?, event_date=?, event_time=?, end_date=?, location=?, category=?, is_featured=? WHERE id=?')
            .run(title, description, event_date, event_time, end_date, location, category, is_featured, parseInt(req.params.id));
        res.json({ message: 'Event updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM events WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Event deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
