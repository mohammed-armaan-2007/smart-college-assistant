const express = require('express');
const { dbPrepare } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Courses
router.get('/', authenticateToken, (req, res) => {
    try {
        const { department, semester } = req.query;
        let query = 'SELECT * FROM courses WHERE 1=1';
        const params = [];
        if (department) { query += ' AND department = ?'; params.push(department); }
        if (semester) { query += ' AND semester = ?'; params.push(parseInt(semester)); }
        query += ' ORDER BY code ASC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { code, name, department, semester, credits, instructor, schedule, description } = req.body;
        const result = dbPrepare('INSERT INTO courses (code, name, department, semester, credits, instructor, schedule, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(code, name, department, semester, credits || 3, instructor, schedule, description);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Course added successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { code, name, department, semester, credits, instructor, schedule, description } = req.body;
        dbPrepare('UPDATE courses SET code=?, name=?, department=?, semester=?, credits=?, instructor=?, schedule=?, description=? WHERE id=?')
            .run(code, name, department, semester, credits, instructor, schedule, description, parseInt(req.params.id));
        res.json({ message: 'Course updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM courses WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Course deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Timetable
router.get('/timetable', authenticateToken, (req, res) => {
    try {
        const { department, semester } = req.query;
        let query = `SELECT t.*, c.code as course_code, c.name as course_name 
                      FROM timetable t JOIN courses c ON t.course_id = c.id WHERE 1=1`;
        const params = [];
        if (department) { query += ' AND t.department = ?'; params.push(department); }
        if (semester) { query += ' AND t.semester = ?'; params.push(parseInt(semester)); }
        query += ` ORDER BY CASE t.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 END, t.start_time`;
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/timetable', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { course_id, day_of_week, start_time, end_time, room, instructor, department, semester } = req.body;
        const result = dbPrepare('INSERT INTO timetable (course_id, day_of_week, start_time, end_time, room, instructor, department, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(course_id, day_of_week, start_time, end_time, room, instructor, department, semester);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Timetable entry added' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/timetable/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM timetable WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Timetable entry deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Assignments
router.get('/assignments', authenticateToken, (req, res) => {
    try {
        const { department, semester, upcoming } = req.query;
        let query = `SELECT a.*, c.code as course_code, c.name as course_name 
                      FROM assignments a JOIN courses c ON a.course_id = c.id WHERE 1=1`;
        const params = [];
        if (department) { query += ' AND a.department = ?'; params.push(department); }
        if (semester) { query += ' AND a.semester = ?'; params.push(parseInt(semester)); }
        if (upcoming === 'true') { query += ' AND a.due_date >= date("now")'; }
        query += ' ORDER BY a.due_date ASC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/assignments', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, description, course_id, due_date, max_marks, department, semester } = req.body;
        const result = dbPrepare('INSERT INTO assignments (title, description, course_id, due_date, max_marks, department, semester) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(title, description, course_id, due_date, max_marks || 100, department, semester);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Assignment created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/assignments/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare('DELETE FROM assignments WHERE id = ?').run(parseInt(req.params.id));
        res.json({ message: 'Assignment deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attendance
router.get('/attendance', authenticateToken, (req, res) => {
    try {
        const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id;
        const { course_id } = req.query;
        let query = `SELECT a.*, c.code as course_code, c.name as course_name 
                      FROM attendance a JOIN courses c ON a.course_id = c.id WHERE a.student_id = ?`;
        const params = [studentId];
        if (course_id) { query += ' AND a.course_id = ?'; params.push(parseInt(course_id)); }
        query += ' ORDER BY a.date DESC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attendance/summary', authenticateToken, (req, res) => {
    try {
        const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id;
        const summary = dbPrepare(`
            SELECT c.code, c.name,
                COUNT(*) as total_classes,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
                ROUND(CAST(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as percentage
            FROM attendance a JOIN courses c ON a.course_id = c.id
            WHERE a.student_id = ?
            GROUP BY a.course_id
        `).all(studentId);
        res.json(summary);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Grades
router.get('/grades', authenticateToken, (req, res) => {
    try {
        const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id;
        const grades = dbPrepare(`
            SELECT g.*, c.code as course_code, c.name as course_name
            FROM grades g JOIN courses c ON g.course_id = c.id
            WHERE g.student_id = ?
            ORDER BY c.code, g.grade_type
        `).all(studentId);
        res.json(grades);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
router.get('/notifications', authenticateToken, (req, res) => {
    try {
        const notifications = dbPrepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
        res.json(notifications);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/:id/read', authenticateToken, (req, res) => {
    try {
        dbPrepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(parseInt(req.params.id), req.user.id);
        res.json({ message: 'Notification marked as read' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
