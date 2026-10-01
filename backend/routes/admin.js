const express = require('express');
const bcrypt = require('bcryptjs');
const { dbPrepare, saveDb } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Dashboard stats
router.get('/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
    try {
        const stats = {
            totalStudents: dbPrepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
            totalCourses: dbPrepare("SELECT COUNT(*) as count FROM courses").get().count,
            totalEvents: dbPrepare("SELECT COUNT(*) as count FROM events").get().count,
            upcomingEvents: dbPrepare("SELECT COUNT(*) as count FROM events WHERE event_date >= date('now')").get().count,
            totalExams: dbPrepare("SELECT COUNT(*) as count FROM exams").get().count,
            upcomingExams: dbPrepare("SELECT COUNT(*) as count FROM exams WHERE exam_date >= date('now')").get().count,
            totalAnnouncements: dbPrepare("SELECT COUNT(*) as count FROM announcements").get().count,
            totalHolidays: dbPrepare("SELECT COUNT(*) as count FROM holidays").get().count,
            totalAssignments: dbPrepare("SELECT COUNT(*) as count FROM assignments").get().count,
            departmentWise: dbPrepare("SELECT department, COUNT(*) as count FROM users WHERE role = 'student' GROUP BY department").all(),
            recentActivity: dbPrepare(`
                SELECT 'event' as type, title, created_at FROM events
                UNION ALL SELECT 'announcement' as type, title, created_at FROM announcements
                UNION ALL SELECT 'exam' as type, subject as title, created_at FROM exams
                ORDER BY created_at DESC LIMIT 10
            `).all()
        };
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Students
router.get('/admin/students', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { department, semester, search } = req.query;
        let query = "SELECT id, username, full_name, email, phone, department, semester, enrollment_no, created_at FROM users WHERE role = 'student'";
        const params = [];
        if (department) { query += ' AND department = ?'; params.push(department); }
        if (semester) { query += ' AND semester = ?'; params.push(parseInt(semester)); }
        if (search) { query += ' AND (full_name LIKE ? OR email LIKE ? OR enrollment_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        query += ' ORDER BY full_name ASC';
        res.json(dbPrepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/students', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { username, password, full_name, email, phone, department, semester, enrollment_no } = req.body;
        const hashedPassword = bcrypt.hashSync(password || 'student123', 10);
        const result = dbPrepare("INSERT INTO users (username, password, role, full_name, email, phone, department, semester, enrollment_no) VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?)")
            .run(username, hashedPassword, full_name, email, phone, department, semester, enrollment_no);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Student added successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/students/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { full_name, email, phone, department, semester, enrollment_no } = req.body;
        dbPrepare('UPDATE users SET full_name=?, email=?, phone=?, department=?, semester=?, enrollment_no=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(full_name, email, phone, department, semester, enrollment_no, parseInt(req.params.id));
        res.json({ message: 'Student updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/students/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        dbPrepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(parseInt(req.params.id));
        res.json({ message: 'Student deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI Chat
router.post('/chat', authenticateToken, (req, res) => {
    try {
        const { message } = req.body;
        const lowerMsg = message.toLowerCase();
        let response = '';

        if (lowerMsg.includes('exam') || lowerMsg.includes('test')) {
            const exams = dbPrepare("SELECT subject, exam_date, exam_time, room FROM exams WHERE exam_date >= date('now') ORDER BY exam_date LIMIT 3").all();
            if (exams.length > 0) {
                response = '📝 Here are your upcoming exams:\n\n';
                exams.forEach(e => { response += `• **${e.subject}** - ${e.exam_date} at ${e.exam_time} in ${e.room}\n`; });
                response += '\nMake sure to prepare well! Would you like to know about the syllabus?';
            } else { response = 'No upcoming exams scheduled at the moment. Keep studying consistently! 📚'; }
        } else if (lowerMsg.includes('holiday') || lowerMsg.includes('vacation') || lowerMsg.includes('leave')) {
            const holidays = dbPrepare("SELECT title, holiday_date, type FROM holidays WHERE holiday_date >= date('now') ORDER BY holiday_date LIMIT 5").all();
            if (holidays.length > 0) {
                response = '🎉 Upcoming holidays:\n\n';
                holidays.forEach(h => { response += `• **${h.title}** - ${h.holiday_date} (${h.type})\n`; });
            } else { response = 'No upcoming holidays found in the calendar.'; }
        } else if (lowerMsg.includes('event') || lowerMsg.includes('fest') || lowerMsg.includes('workshop')) {
            const events = dbPrepare("SELECT title, event_date, location FROM events WHERE event_date >= date('now') ORDER BY event_date LIMIT 5").all();
            if (events.length > 0) {
                response = '🎊 Upcoming events:\n\n';
                events.forEach(e => { response += `• **${e.title}** - ${e.event_date} at ${e.location}\n`; });
                response += '\nWould you like more details about any event?';
            } else { response = 'No upcoming events at the moment. Stay tuned! 🔔'; }
        } else if (lowerMsg.includes('assignment') || lowerMsg.includes('homework') || lowerMsg.includes('submission')) {
            const assignments = dbPrepare("SELECT a.title, a.due_date, c.code FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.due_date >= date('now') ORDER BY a.due_date LIMIT 5").all();
            if (assignments.length > 0) {
                response = '📋 Pending assignments:\n\n';
                assignments.forEach(a => { response += `• **${a.title}** (${a.code}) - Due: ${a.due_date}\n`; });
                response += "\nDon't forget to submit on time! ⏰";
            } else { response = 'No pending assignments. Great job staying on top of things! 🌟'; }
        } else if (lowerMsg.includes('attendance') || lowerMsg.includes('absent') || lowerMsg.includes('present')) {
            response = '📊 You can check your detailed attendance in the **Attendance** section from the sidebar. Maintaining above 75% attendance is mandatory for exam eligibility.';
        } else if (lowerMsg.includes('grade') || lowerMsg.includes('marks') || lowerMsg.includes('result') || lowerMsg.includes('score')) {
            response = '📈 Your grades and marks are available in the **Grades** section. You can view subject-wise breakdowns of all your assessments.';
        } else if (lowerMsg.includes('timetable') || lowerMsg.includes('schedule') || lowerMsg.includes('class')) {
            response = '🕐 Your class timetable is available in the **Timetable** section. You can view your weekly schedule with room numbers and instructor details.';
        } else if (lowerMsg.includes('library') || lowerMsg.includes('book')) {
            response = '📚 The Central Library is open from 8 AM to 8 PM (extended to 11 PM during exams). You can borrow up to 5 books at a time.';
        } else if (lowerMsg.includes('fee') || lowerMsg.includes('payment') || lowerMsg.includes('scholarship')) {
            response = '💰 For fee-related queries:\n\n• **Fee Payment**: Visit the Accounts Office or pay online\n• **Scholarships**: Check the Announcements section\n• **Fee Structure**: Available at the Accounts Office';
        } else if (lowerMsg.includes('placement') || lowerMsg.includes('job') || lowerMsg.includes('intern') || lowerMsg.includes('career')) {
            response = '💼 Placement & Career Info:\n\n• **Placement Cell**: Block A, Ground Floor\n• **Top Recruiters**: TCS, Infosys, Wipro, Google, Microsoft, Amazon\n• **Internships**: Register on the placement portal';
        } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.includes('good')) {
            response = "👋 Hello! I'm your Smart College Assistant. I can help you with:\n\n• 📝 **Exam schedules** and syllabus\n• 📅 **Holiday** calendar\n• 🎊 **Events** and workshops\n• 📋 **Assignments** and deadlines\n• 📊 **Attendance** information\n• 📈 **Grades** and results\n\nJust ask me anything!";
        } else if (lowerMsg.includes('help') || lowerMsg.includes('what can you')) {
            response = '🤖 I can assist you with:\n\n1. **Academic Info**: Exams, timetable, assignments, grades, attendance\n2. **Campus Life**: Events, holidays, library, placements\n3. **Administrative**: Fees, scholarships, hostel\n\nTry: "When are my exams?", "Show upcoming events", or "What holidays are coming up?"';
        } else if (lowerMsg.includes('thank')) {
            response = "😊 You're welcome! Feel free to ask me anything else. I'm here to help you succeed! 🎓";
        } else {
            response = '🤔 I\'m not sure about that. Try asking about **exams**, **holidays**, **events**, **assignments**, **attendance**, **grades**, **placements**, or type "help" for options!';
        }

        dbPrepare('INSERT INTO chat_messages (user_id, message, response) VALUES (?, ?, ?)').run(req.user.id, message, response);
        res.json({ response, timestamp: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/chat/history', authenticateToken, (req, res) => {
    try {
        const history = dbPrepare('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
        res.json(history);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Calendar
router.get('/calendar', authenticateToken, (req, res) => {
    try {
        const events = dbPrepare('SELECT id, title, event_date as date, category as type, "event" as source FROM events ORDER BY event_date').all();
        const holidays = dbPrepare('SELECT id, title, holiday_date as date, type, "holiday" as source FROM holidays ORDER BY holiday_date').all();
        const exams = dbPrepare('SELECT id, subject as title, exam_date as date, exam_type as type, "exam" as source FROM exams ORDER BY exam_date').all();
        const assignments = dbPrepare('SELECT a.id, a.title, a.due_date as date, "assignment" as type, "assignment" as source FROM assignments a ORDER BY a.due_date').all();
        
        const calendarItems = [...events, ...holidays, ...exams, ...assignments];
        calendarItems.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        res.json(calendarItems);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Student dashboard
router.get('/student/dashboard', authenticateToken, (req, res) => {
    try {
        const user = dbPrepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        const dept = user ? user.department : '';
        
        const stats = {
            upcomingExams: dbPrepare("SELECT COUNT(*) as count FROM exams WHERE exam_date >= date('now')").get().count,
            pendingAssignments: dbPrepare("SELECT COUNT(*) as count FROM assignments WHERE due_date >= date('now')").get().count,
            upcomingEvents: dbPrepare("SELECT COUNT(*) as count FROM events WHERE event_date >= date('now')").get().count,
            unreadNotifications: dbPrepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0").get(req.user.id).count,
            upcomingHolidays: dbPrepare("SELECT COUNT(*) as count FROM holidays WHERE holiday_date >= date('now')").get().count,
            nextExam: dbPrepare("SELECT subject, exam_date, exam_time FROM exams WHERE exam_date >= date('now') ORDER BY exam_date LIMIT 1").get(),
            nextEvent: dbPrepare("SELECT title, event_date FROM events WHERE event_date >= date('now') ORDER BY event_date LIMIT 1").get(),
            nextHoliday: dbPrepare("SELECT title, holiday_date FROM holidays WHERE holiday_date >= date('now') ORDER BY holiday_date LIMIT 1").get(),
            recentAnnouncements: dbPrepare("SELECT title, content, priority, created_at FROM announcements ORDER BY is_pinned DESC, created_at DESC LIMIT 5").all()
        };
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
