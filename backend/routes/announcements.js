const express = require('express');
const { dbPrepare } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    try {
        const { priority, department, pinned } = req.query;
        let query = 'SELECT a.*, u.full_name as author FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE 1=1';
        const params = [];
        if (priority) { query += ' AND a.priority = ?'; params.push(priority); }
        if (department) { query += ' AND (a.department = ? OR a.department IS NULL)'; params.push(department); }
        if (pinned === 'true') { query += ' AND a.is_pinned = 1'; }
        query += ' ORDER BY a.is_pinned DESC, a.created_at DESC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, content, priority, target_audience, department, is_pinned, expires_at } = req.body;
        const result = dbPrepare('INSERT INTO announcements (title, content, priority, target_audience, department, is_pinned, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(title, content, priority || 'normal', target_audience || 'all', department, is_pinned || 0, expires_at, req.user.id);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Announcement created successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, content, priority, target_audience, department, is_pinned, expires_at } = req.body;
        dbPrepare('UPDATE announcements SET title=?, content=?, priority=?, target_audience=?, department=?, is_pinned=?, expires_at=? WHERE id=?')
            .run(title, content, priority, target_audience, department, is_pinned, expires_at, parseInt(req.params.id));
        res.json({ message: 'Announcement updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM announcements WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Announcement deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
