const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'college.db');

let db = null;
let SQL = null;

function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

async function initializeDatabase() {
    SQL = await initSqlJs();
    
    // Load existing DB or create new
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            department TEXT,
            semester INTEGER,
            enrollment_no TEXT UNIQUE,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            event_date DATE NOT NULL,
            event_time TIME,
            end_date DATE,
            location TEXT,
            category TEXT DEFAULT 'general',
            image_url TEXT,
            is_featured INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            holiday_date DATE NOT NULL,
            type TEXT DEFAULT 'public',
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            exam_date DATE NOT NULL,
            exam_time TIME,
            duration_minutes INTEGER DEFAULT 180,
            room TEXT,
            department TEXT,
            semester INTEGER,
            exam_type TEXT DEFAULT 'regular',
            syllabus TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            target_audience TEXT DEFAULT 'all',
            department TEXT,
            is_pinned INTEGER DEFAULT 0,
            expires_at DATE,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            semester INTEGER,
            credits INTEGER DEFAULT 3,
            instructor TEXT,
            schedule TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS timetable (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            day_of_week TEXT NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            room TEXT,
            instructor TEXT,
            department TEXT,
            semester INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            course_id INTEGER,
            due_date DATE NOT NULL,
            max_marks INTEGER DEFAULT 100,
            department TEXT,
            semester INTEGER,
            attachment_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            course_id INTEGER,
            date DATE NOT NULL,
            status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            course_id INTEGER,
            assignment_title TEXT,
            marks_obtained REAL,
            max_marks REAL DEFAULT 100,
            grade_type TEXT DEFAULT 'assignment',
            semester INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT NOT NULL,
            response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            link TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Seed demo data
    seedDemoData();
    saveDb();
}

function getDb() {
    return db;
}

// ============================
// sql.js helper wrappers to match better-sqlite3 API
// ============================
function dbPrepare(sql) {
    return {
        run: function(...params) {
            db.run(sql, params);
            saveDb();
            const lastId = db.exec('SELECT last_insert_rowid() as id');
            const changes = db.getRowsModified();
            return { lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : 0, changes };
        },
        get: function(...params) {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const cols = stmt.getColumnNames();
                const vals = stmt.get();
                stmt.free();
                const row = {};
                cols.forEach((c, i) => row[c] = vals[i]);
                return row;
            }
            stmt.free();
            return undefined;
        },
        all: function(...params) {
            const results = [];
            const stmt = db.prepare(sql);
            stmt.bind(params);
            while (stmt.step()) {
                const cols = stmt.getColumnNames();
                const vals = stmt.get();
                const row = {};
                cols.forEach((c, i) => row[c] = vals[i]);
                results.push(row);
            }
            stmt.free();
            return results;
        }
    };
}

function seedDemoData() {
    const countResult = db.exec("SELECT COUNT(*) as count FROM users");
    if (countResult.length > 0 && countResult[0].values[0][0] > 0) return;

    console.log('🌱 Seeding demo database...');

    const adminPass = bcrypt.hashSync('admin123', 10);
    const studentPass = bcrypt.hashSync('student123', 10);

    // Admin users
    db.run("INSERT INTO users (username, password, role, full_name, email, phone, department, semester, enrollment_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ['admin', adminPass, 'admin', 'Dr. Rajesh Kumar', 'admin@college.edu', '9876543210', 'Administration', null, null]);
    db.run("INSERT INTO users (username, password, role, full_name, email, phone, department, semester, enrollment_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ['hod_cs', adminPass, 'admin', 'Prof. Anita Sharma', 'hod.cs@college.edu', '9876543211', 'Computer Science', null, null]);

    // Students
    const students = [
        ['student1', studentPass, 'student', 'Aarav Patel', 'aarav@student.edu', '9876543220', 'Computer Science', 3, 'CS2024001'],
        ['student2', studentPass, 'student', 'Priya Singh', 'priya@student.edu', '9876543221', 'Computer Science', 5, 'CS2024002'],
        ['student3', studentPass, 'student', 'Rohan Gupta', 'rohan@student.edu', '9876543222', 'Computer Science', 5, 'CS2024003'],
        ['student4', studentPass, 'student', 'Sneha Reddy', 'sneha@student.edu', '9876543223', 'Electronics', 3, 'EC2024001'],
        ['student5', studentPass, 'student', 'Vikram Joshi', 'vikram@student.edu', '9876543224', 'Mechanical', 3, 'ME2024001'],
        ['student6', studentPass, 'student', 'Ananya Nair', 'ananya@student.edu', '9876543225', 'Computer Science', 7, 'CS2024004'],
        ['student7', studentPass, 'student', 'Karthik Menon', 'karthik@student.edu', '9876543226', 'Electronics', 5, 'EC2024002'],
        ['student8', studentPass, 'student', 'Divya Iyer', 'divya@student.edu', '9876543227', 'Civil', 3, 'CE2024001'],
        ['student9', studentPass, 'student', 'Arjun Das', 'arjun@student.edu', '9876543228', 'Electrical', 5, 'EE2024001'],
        ['student10', studentPass, 'student', 'Meera Kapoor', 'meera@student.edu', '9876543229', 'Computer Science', 7, 'CS2024005']
    ];

    students.forEach(s => {
        db.run("INSERT INTO users (username, password, role, full_name, email, phone, department, semester, enrollment_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", s);
    });

    // Events
    const events = [
        ['Annual Tech Fest 2026', 'Join us for the biggest technology festival of the year! Featuring hackathons, workshops, tech talks, and exciting competitions.', '2026-10-15', '09:00', '2026-10-17', 'Main Campus', 'cultural', 1, 1],
        ['AI & Machine Learning Workshop', 'Hands-on workshop on building ML models with TensorFlow and PyTorch. Bring your laptops!', '2026-10-08', '10:00', '2026-10-08', 'Lab 301, CS Block', 'workshop', 1, 1],
        ['Guest Lecture: Future of Quantum Computing', 'Dr. Sarah Chen from MIT will discuss the latest breakthroughs in quantum computing.', '2026-10-12', '14:00', '2026-10-12', 'Auditorium Hall', 'seminar', 0, 1],
        ['Inter-College Sports Meet', 'Annual sports competition featuring cricket, football, basketball, athletics and more.', '2026-10-20', '08:00', '2026-10-22', 'Sports Complex', 'sports', 1, 1],
        ['Placement Drive - TCS', 'TCS campus recruitment drive for final year students. Register before Oct 5.', '2026-10-10', '09:00', '2026-10-11', 'Placement Cell, Block A', 'placement', 1, 1],
        ['Coding Competition: Code Storm', 'Test your coding skills in this 6-hour competitive programming contest. Amazing prizes to be won!', '2026-10-25', '10:00', '2026-10-25', 'Computer Lab 1 & 2', 'competition', 0, 1],
        ['Cultural Night & Music Fest', 'An evening of music, dance, drama and cultural performances by students.', '2026-11-05', '17:00', '2026-11-05', 'Open Air Theatre', 'cultural', 1, 1],
        ['Entrepreneurship Summit', 'Learn from successful entrepreneurs and pitch your startup ideas to potential investors.', '2026-11-12', '09:00', '2026-11-12', 'Conference Hall', 'seminar', 0, 1],
        ['Blood Donation Camp', 'Give the gift of life. Blood donation camp organized by NSS unit.', '2026-10-28', '09:00', '2026-10-28', 'Health Center', 'social', 0, 1],
        ['Alumni Meet 2026', 'Annual gathering of alumni. Networking, mentorship sessions, and nostalgia!', '2026-11-20', '10:00', '2026-11-20', 'Main Auditorium', 'general', 1, 1]
    ];

    events.forEach(e => {
        db.run("INSERT INTO events (title, description, event_date, event_time, end_date, location, category, is_featured, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", e);
    });

    // Holidays
    const holidays = [
        ['Gandhi Jayanti', '2026-10-02', 'national', 'Birth anniversary of Mahatma Gandhi'],
        ['Dussehra', '2026-10-15', 'festival', 'Victory of good over evil - Vijayadashami'],
        ['Milad-un-Nabi', '2026-10-19', 'religious', 'Birthday of Prophet Muhammad'],
        ['Diwali', '2026-11-04', 'festival', 'Festival of Lights'],
        ['Diwali Vacation Start', '2026-11-03', 'festival', 'Diwali vacation begins'],
        ['Diwali Vacation End', '2026-11-05', 'festival', 'Diwali vacation ends'],
        ['Guru Nanak Jayanti', '2026-11-08', 'religious', 'Birth anniversary of Guru Nanak Dev'],
        ['Christmas', '2026-12-25', 'festival', 'Christmas Day celebrations'],
        ['New Year', '2027-01-01', 'public', 'New Year Day'],
        ['Republic Day', '2027-01-26', 'national', 'Republic Day of India'],
        ['Holi', '2027-03-14', 'festival', 'Festival of Colors'],
        ['Good Friday', '2027-03-26', 'religious', 'Good Friday observance'],
        ['Winter Break Start', '2026-12-23', 'vacation', 'Winter vacation begins'],
        ['Winter Break End', '2027-01-02', 'vacation', 'Winter vacation ends']
    ];

    holidays.forEach(h => {
        db.run("INSERT INTO holidays (title, holiday_date, type, description) VALUES (?, ?, ?, ?)", h);
    });

    // Exams
    const exams = [
        ['Data Structures & Algorithms', '2026-11-15', '09:00', 180, 'Hall A', 'Computer Science', 3, 'mid-semester', 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs'],
        ['Database Management Systems', '2026-11-17', '09:00', 180, 'Hall B', 'Computer Science', 5, 'mid-semester', 'ER Model, Relational Algebra, SQL, Normalization'],
        ['Operating Systems', '2026-11-19', '09:00', 180, 'Hall A', 'Computer Science', 5, 'mid-semester', 'Process Management, Memory Management, File Systems'],
        ['Computer Networks', '2026-11-21', '09:00', 180, 'Hall C', 'Computer Science', 7, 'mid-semester', 'OSI Model, TCP/IP, Routing, Network Security'],
        ['Digital Electronics', '2026-11-16', '14:00', 180, 'Hall D', 'Electronics', 3, 'mid-semester', 'Boolean Algebra, Combinational Circuits, Sequential Circuits'],
        ['Signal Processing', '2026-11-18', '14:00', 180, 'Hall D', 'Electronics', 5, 'mid-semester', 'Fourier Transform, Z-Transform, Filters'],
        ['Engineering Mathematics III', '2026-11-14', '09:00', 180, 'Hall A & B', 'Computer Science', 3, 'mid-semester', 'Laplace Transform, Fourier Series, PDE'],
        ['Machine Learning', '2026-11-23', '09:00', 180, 'Hall C', 'Computer Science', 7, 'mid-semester', 'Regression, Classification, Neural Networks, SVM'],
        ['Thermodynamics', '2026-11-20', '14:00', 180, 'Hall E', 'Mechanical', 3, 'mid-semester', 'Laws of Thermodynamics, Entropy, Heat Engines'],
        ['Structural Analysis', '2026-11-22', '14:00', 180, 'Hall F', 'Civil', 5, 'mid-semester', 'Deflection, Influence Lines, Arches']
    ];

    exams.forEach(e => {
        db.run("INSERT INTO exams (subject, exam_date, exam_time, duration_minutes, room, department, semester, exam_type, syllabus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", e);
    });

    // Announcements
    const announcements = [
        ['Mid-Semester Exam Schedule Released', 'The mid-semester examination schedule for all departments has been released. Please check the exam section for detailed timetable. Students must carry their ID cards.', 'high', 'all', null, 1, '2026-11-25', 1],
        ['Library Extended Hours During Exams', 'The central library will remain open from 7 AM to 11 PM during the examination period (Nov 14 - Nov 23). Make the most of this facility!', 'normal', 'all', null, 0, '2026-11-25', 1],
        ['Scholarship Applications Open', 'Applications for Merit-cum-Means scholarship for the academic year 2026-27 are now open. Last date to apply: October 31, 2026.', 'high', 'all', null, 1, '2026-10-31', 1],
        ['Hostel Room Allocation', 'Room allocation for the new semester has been finalized. Check the hostel office notice board for your room assignment.', 'normal', 'all', null, 0, '2026-10-15', 1],
        ['Workshop Registration Open', 'Register for the AI & ML Workshop happening on Oct 8. Limited seats available! Register through the events section.', 'normal', 'all', 'Computer Science', 0, '2026-10-08', 1],
        ['Fee Payment Reminder', 'Last date for semester fee payment without late fee is October 15, 2026. Pay through the online portal or at the accounts office.', 'urgent', 'all', null, 1, '2026-10-15', 1],
        ['Campus WiFi Upgrade', 'The campus WiFi network will be upgraded on Oct 5 (Sunday). Expect intermittent connectivity between 6 AM - 12 PM.', 'normal', 'all', null, 0, '2026-10-05', 1],
        ['Placement Training Sessions', 'Aptitude and soft skills training sessions for final year students begin Oct 6. Attendance is mandatory.', 'high', 'all', null, 0, '2026-12-01', 1]
    ];

    announcements.forEach(a => {
        db.run("INSERT INTO announcements (title, content, priority, target_audience, department, is_pinned, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", a);
    });

    // Courses
    const courses = [
        ['CS301', 'Data Structures & Algorithms', 'Computer Science', 3, 4, 'Prof. Anita Sharma', 'Mon, Wed, Fri 9:00-10:00', 'Study of fundamental data structures and algorithmic techniques'],
        ['CS302', 'Object Oriented Programming', 'Computer Science', 3, 3, 'Dr. Ramesh Iyer', 'Tue, Thu 10:00-11:30', 'OOP concepts using Java and C++'],
        ['CS501', 'Database Management Systems', 'Computer Science', 5, 4, 'Prof. Meena Kumari', 'Mon, Wed 11:00-12:30', 'Relational databases, SQL, normalization and database design'],
        ['CS502', 'Operating Systems', 'Computer Science', 5, 4, 'Dr. Suresh Babu', 'Tue, Thu 9:00-10:30', 'Process management, memory management, file systems'],
        ['CS701', 'Machine Learning', 'Computer Science', 7, 4, 'Dr. Priya Naik', 'Mon, Wed, Fri 11:00-12:00', 'Supervised and unsupervised learning algorithms'],
        ['CS702', 'Computer Networks', 'Computer Science', 7, 3, 'Prof. Arun Verma', 'Tue, Thu 14:00-15:30', 'Network architecture, protocols, and security'],
        ['MA301', 'Engineering Mathematics III', 'Computer Science', 3, 4, 'Dr. Lakshmi Devi', 'Mon, Wed, Fri 8:00-9:00', 'Advanced mathematics for engineering students'],
        ['EC301', 'Digital Electronics', 'Electronics', 3, 4, 'Prof. Ravi Shankar', 'Mon, Wed 10:00-11:30', 'Digital logic design and implementation'],
        ['EC501', 'Signal Processing', 'Electronics', 5, 4, 'Dr. Kavitha Rao', 'Tue, Thu 11:00-12:30', 'Analog and digital signal processing'],
        ['ME301', 'Thermodynamics', 'Mechanical', 3, 4, 'Prof. Ganesh Pillai', 'Mon, Wed, Fri 10:00-11:00', 'Fundamentals of thermodynamics and heat transfer']
    ];

    courses.forEach(c => {
        db.run("INSERT INTO courses (code, name, department, semester, credits, instructor, schedule, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", c);
    });

    // Timetable
    const timetableEntries = [
        [1, 'Monday', '09:00', '10:00', 'Room 301', 'Prof. Anita Sharma', 'Computer Science', 3],
        [1, 'Wednesday', '09:00', '10:00', 'Room 301', 'Prof. Anita Sharma', 'Computer Science', 3],
        [1, 'Friday', '09:00', '10:00', 'Room 301', 'Prof. Anita Sharma', 'Computer Science', 3],
        [7, 'Monday', '08:00', '09:00', 'Room 201', 'Dr. Lakshmi Devi', 'Computer Science', 3],
        [7, 'Wednesday', '08:00', '09:00', 'Room 201', 'Dr. Lakshmi Devi', 'Computer Science', 3],
        [7, 'Friday', '08:00', '09:00', 'Room 201', 'Dr. Lakshmi Devi', 'Computer Science', 3],
        [2, 'Tuesday', '10:00', '11:30', 'Lab 101', 'Dr. Ramesh Iyer', 'Computer Science', 3],
        [2, 'Thursday', '10:00', '11:30', 'Lab 101', 'Dr. Ramesh Iyer', 'Computer Science', 3],
        [3, 'Monday', '11:00', '12:30', 'Room 401', 'Prof. Meena Kumari', 'Computer Science', 5],
        [3, 'Wednesday', '11:00', '12:30', 'Room 401', 'Prof. Meena Kumari', 'Computer Science', 5],
        [4, 'Tuesday', '09:00', '10:30', 'Room 402', 'Dr. Suresh Babu', 'Computer Science', 5],
        [4, 'Thursday', '09:00', '10:30', 'Room 402', 'Dr. Suresh Babu', 'Computer Science', 5],
        [5, 'Monday', '11:00', '12:00', 'Room 501', 'Dr. Priya Naik', 'Computer Science', 7],
        [5, 'Wednesday', '11:00', '12:00', 'Room 501', 'Dr. Priya Naik', 'Computer Science', 7],
        [5, 'Friday', '11:00', '12:00', 'Room 501', 'Dr. Priya Naik', 'Computer Science', 7],
        [6, 'Tuesday', '14:00', '15:30', 'Room 502', 'Prof. Arun Verma', 'Computer Science', 7],
        [6, 'Thursday', '14:00', '15:30', 'Room 502', 'Prof. Arun Verma', 'Computer Science', 7],
        [8, 'Monday', '10:00', '11:30', 'Room 201E', 'Prof. Ravi Shankar', 'Electronics', 3],
        [8, 'Wednesday', '10:00', '11:30', 'Room 201E', 'Prof. Ravi Shankar', 'Electronics', 3],
        [9, 'Tuesday', '11:00', '12:30', 'Room 301E', 'Dr. Kavitha Rao', 'Electronics', 5],
        [9, 'Thursday', '11:00', '12:30', 'Room 301E', 'Dr. Kavitha Rao', 'Electronics', 5],
        [10, 'Monday', '10:00', '11:00', 'Room 101M', 'Prof. Ganesh Pillai', 'Mechanical', 3],
        [10, 'Wednesday', '10:00', '11:00', 'Room 101M', 'Prof. Ganesh Pillai', 'Mechanical', 3],
        [10, 'Friday', '10:00', '11:00', 'Room 101M', 'Prof. Ganesh Pillai', 'Mechanical', 3]
    ];

    timetableEntries.forEach(t => {
        db.run("INSERT INTO timetable (course_id, day_of_week, start_time, end_time, room, instructor, department, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", t);
    });

    // Assignments
    const assignments = [
        ['Implement Binary Search Tree', 'Implement BST with insert, delete, search, and traversal operations in C/C++.', 1, '2026-10-10', 50, 'Computer Science', 3],
        ['SQL Query Assignment', 'Write complex SQL queries for the given database schema. Includes joins, subqueries, and aggregate functions.', 3, '2026-10-12', 40, 'Computer Science', 5],
        ['Process Scheduling Simulation', 'Simulate FCFS, SJF, and Round Robin scheduling algorithms. Compare their performance.', 4, '2026-10-18', 60, 'Computer Science', 5],
        ['Neural Network from Scratch', 'Implement a simple neural network without using ML libraries. Train on MNIST dataset.', 5, '2026-10-20', 100, 'Computer Science', 7],
        ['Java OOP Project', 'Build a Library Management System using Java OOP concepts including inheritance and polymorphism.', 2, '2026-10-15', 80, 'Computer Science', 3],
        ['Network Protocol Analysis', 'Capture and analyze network packets using Wireshark. Submit a detailed report.', 6, '2026-10-25', 50, 'Computer Science', 7],
        ['Fourier Transform Problems', 'Solve the given set of 20 problems on Fourier Transform and its applications.', 7, '2026-10-08', 30, 'Computer Science', 3],
        ['Logic Circuit Design', 'Design a 4-bit ALU using logic gates. Submit both the circuit diagram and simulation.', 8, '2026-10-14', 60, 'Electronics', 3]
    ];

    assignments.forEach(a => {
        db.run("INSERT INTO assignments (title, description, course_id, due_date, max_marks, department, semester) VALUES (?, ?, ?, ?, ?, ?, ?)", a);
    });

    // Attendance for student1 (id=3)
    const statuses = ['present', 'present', 'present', 'absent', 'present', 'present', 'late', 'present', 'present', 'present', 'present', 'present'];
    const attendanceDates = [
        '2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08', '2026-09-10', '2026-09-12',
        '2026-09-15', '2026-09-17', '2026-09-19', '2026-09-22', '2026-09-24', '2026-09-26'
    ];

    attendanceDates.forEach((date, i) => {
        db.run("INSERT INTO attendance (student_id, course_id, date, status) VALUES (?, ?, ?, ?)", [3, 1, date, statuses[i]]);
        db.run("INSERT INTO attendance (student_id, course_id, date, status) VALUES (?, ?, ?, ?)", [3, 7, date, statuses[(i + 1) % statuses.length]]);
    });

    // Grades
    const grades = [
        [3, 1, 'Quiz 1', 18, 20, 'quiz', 3],
        [3, 1, 'Assignment 1', 42, 50, 'assignment', 3],
        [3, 7, 'Quiz 1', 15, 20, 'quiz', 3],
        [3, 7, 'Assignment 1', 25, 30, 'assignment', 3],
        [3, 2, 'Lab Test 1', 38, 40, 'lab', 3],
        [3, 1, 'Mid-Term', 72, 100, 'exam', 3],
        [3, 7, 'Mid-Term', 65, 100, 'exam', 3],
        [3, 2, 'Mid-Term', 78, 100, 'exam', 3],
    ];

    grades.forEach(g => {
        db.run("INSERT INTO grades (student_id, course_id, assignment_title, marks_obtained, max_marks, grade_type, semester) VALUES (?, ?, ?, ?, ?, ?, ?)", g);
    });

    // Notifications
    const notifications = [
        [3, 'Assignment Due Soon', 'Binary Search Tree assignment is due on Oct 10', 'warning', 0, '/assignments'],
        [3, 'New Event', 'AI & ML Workshop registration is open!', 'info', 0, '/events'],
        [3, 'Exam Schedule', 'Mid-semester exam schedule has been released', 'important', 0, '/exams'],
        [3, 'Grade Posted', 'Your Mid-Term grade for DSA has been posted', 'success', 1, '/grades'],
        [3, 'Holiday Notice', 'Campus will be closed on Oct 2 for Gandhi Jayanti', 'info', 1, '/calendar'],
    ];

    notifications.forEach(n => {
        db.run("INSERT INTO notifications (user_id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, ?, ?)", n);
    });

    console.log('✅ Demo database seeded successfully!');
}

module.exports = { getDb, initializeDatabase, dbPrepare, saveDb };
