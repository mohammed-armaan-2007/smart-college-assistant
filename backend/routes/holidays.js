const express = require('express');
const { dbPrepare } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    try {
        const { type, upcoming } = req.query;
        let query = 'SELECT * FROM holidays WHERE 1=1';
        const params = [];
        if (type) { query += ' AND type = ?'; params.push(type); }
        if (upcoming === 'true') { query += ' AND holiday_date >= date("now")'; }
        query += ' ORDER BY holiday_date ASC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, holiday_date, type, description } = req.body;
        const result = dbPrepare('INSERT INTO holidays (title, holiday_date, type, description) VALUES (?, ?, ?, ?)')
            .run(title, holiday_date, type || 'public', description);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Holiday added successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, holiday_date, type, description } = req.body;
        dbPrepare('UPDATE holidays SET title=?, holiday_date=?, type=?, description=? WHERE id=?')
            .run(title, holiday_date, type, description, parseInt(req.params.id));
        res.json({ message: 'Holiday updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM holidays WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Holiday deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
