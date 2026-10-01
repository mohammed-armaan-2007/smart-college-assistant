const express = require('express');
const bcrypt = require('bcryptjs');
const { dbPrepare } = require('../database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = dbPrepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateToken(user);
        const { password: _, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/profile', authenticateToken, (req, res) => {
    try {
        const user = dbPrepare('SELECT id, username, role, full_name, email, phone, department, semester, enrollment_no, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', authenticateToken, (req, res) => {
    try {
        const { full_name, email, phone } = req.body;
        dbPrepare('UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(full_name, email, phone, req.user.id);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/change-password', authenticateToken, (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const user = dbPrepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        if (!bcrypt.compareSync(current_password, user.password)) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        const hashedPassword = bcrypt.hashSync(new_password, 10);
        dbPrepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.user.id);
        res.json({ message: 'Password changed successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
