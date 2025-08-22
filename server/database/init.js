const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

const DB_PATH = path.join(__dirname, 'attendance.db');

let db = null;

const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = async () => {
  return new Promise((resolve, reject) => {
    const queries = [
      // Users table (teachers/admins)
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'teacher' CHECK(role IN ('admin', 'teacher')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Students table
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        department TEXT,
        year INTEGER,
        face_encoding TEXT,
        photo_path TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Subjects table
      `CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        teacher_id INTEGER,
        department TEXT,
        year INTEGER,
        semester INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users (id)
      )`,
      
      // Attendance sessions table
      `CREATE TABLE IF NOT EXISTS attendance_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        session_name TEXT NOT NULL,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        location TEXT,
        session_type TEXT DEFAULT 'lecture' CHECK(session_type IN ('lecture', 'lab', 'tutorial', 'exam')),
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`,
      
      // Attendance records table
      `CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late', 'excused')),
        marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        marked_by INTEGER,
        method TEXT DEFAULT 'manual' CHECK(method IN ('manual', 'face_recognition', 'qr_code')),
        confidence_score REAL,
        notes TEXT,
        FOREIGN KEY (session_id) REFERENCES attendance_sessions (id),
        FOREIGN KEY (student_id) REFERENCES students (id),
        FOREIGN KEY (marked_by) REFERENCES users (id),
        UNIQUE(session_id, student_id)
      )`,
      
      // Student-Subject enrollment table
      `CREATE TABLE IF NOT EXISTS student_subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (student_id) REFERENCES students (id),
        FOREIGN KEY (subject_id) REFERENCES subjects (id),
        UNIQUE(student_id, subject_id)
      )`,
      
      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' CHECK(type IN ('info', 'warning', 'error', 'success')),
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`
    ];

    let completed = 0;
    const total = queries.length;

    queries.forEach((query, index) => {
      db.run(query, (err) => {
        if (err) {
          console.error(`Error creating table ${index}:`, err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          console.log('All database tables created successfully');
          createIndexes().then(resolve).catch(reject);
        }
      });
    });
  });
};

const createIndexes = async () => {
  return new Promise((resolve, reject) => {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_no)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_subject ON attendance_sessions(subject_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(date)',
      'CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON student_subjects(subject_id)'
    ];

    let completed = 0;
    const total = indexes.length;

    indexes.forEach((indexQuery) => {
      db.run(indexQuery, (err) => {
        if (err) {
          console.error('Error creating index:', err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          console.log('All database indexes created successfully');
          resolve();
        }
      });
    });
  });
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};