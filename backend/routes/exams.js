const express = require('express');
const { dbPrepare } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    try {
        const { department, semester, upcoming, exam_type } = req.query;
        let query = 'SELECT * FROM exams WHERE 1=1';
        const params = [];
        if (department) { query += ' AND department = ?'; params.push(department); }
        if (semester) { query += ' AND semester = ?'; params.push(parseInt(semester)); }
        if (upcoming === 'true') { query += ' AND exam_date >= date("now")'; }
        if (exam_type) { query += ' AND exam_type = ?'; params.push(exam_type); }
        query += ' ORDER BY exam_date ASC, exam_time ASC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { subject, exam_date, exam_time, duration_minutes, room, department, semester, exam_type, syllabus } = req.body;
        const result = dbPrepare('INSERT INTO exams (subject, exam_date, exam_time, duration_minutes, room, department, semester, exam_type, syllabus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(subject, exam_date, exam_time, duration_minutes || 180, room, department, semester, exam_type || 'regular', syllabus);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Exam scheduled successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { subject, exam_date, exam_time, duration_minutes, room, department, semester, exam_type, syllabus } = req.body;
        dbPrepare('UPDATE exams SET subject=?, exam_date=?, exam_time=?, duration_minutes=?, room=?, department=?, semester=?, exam_type=?, syllabus=? WHERE id=?')
            .run(subject, exam_date, exam_time, duration_minutes, room, department, semester, exam_type, syllabus, parseInt(req.params.id));
        res.json({ message: 'Exam updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM exams WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Exam deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
