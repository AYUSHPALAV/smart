const express = require('express');
const moment = require('moment');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get attendance sessions
router.get('/sessions', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { subject_id, date, limit = 50 } = req.query;
  
  let query = `
    SELECT ats.*, s.name as subject_name, s.code as subject_code, u.name as created_by_name
    FROM attendance_sessions ats
    JOIN subjects s ON ats.subject_id = s.id
    LEFT JOIN users u ON ats.created_by = u.id
    WHERE ats.is_active = 1
  `;
  const params = [];
  
  if (subject_id) {
    query += ' AND ats.subject_id = ?';
    params.push(subject_id);
  }
  
  if (date) {
    query += ' AND ats.date = ?';
    params.push(date);
  }
  
  // Filter by teacher's subjects if not admin
  if (req.user.role === 'teacher') {
    query += ' AND s.teacher_id = ?';
    params.push(req.user.id);
  }
  
  query += ' ORDER BY ats.date DESC, ats.start_time DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sessions);
  });
});

// Get specific attendance session
router.get('/sessions/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const sessionId = req.params.id;
  
  const query = `
    SELECT ats.*, s.name as subject_name, s.code as subject_code, u.name as created_by_name
    FROM attendance_sessions ats
    JOIN subjects s ON ats.subject_id = s.id
    LEFT JOIN users u ON ats.created_by = u.id
    WHERE ats.id = ?
  `;
  
  db.get(query, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  });
});

// Create attendance session
router.post('/sessions', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const { subject_id, session_name, date, start_time, end_time, location, session_type = 'lecture' } = req.body;
  
  if (!subject_id || !session_name || !date) {
    return res.status(400).json({ error: 'Subject ID, session name, and date are required' });
  }
  
  const db = getDatabase();
  
  // Verify user can create session for this subject
  let checkQuery = 'SELECT * FROM subjects WHERE id = ? AND is_active = 1';
  let checkParams = [subject_id];
  
  if (req.user.role === 'teacher') {
    checkQuery += ' AND teacher_id = ?';
    checkParams.push(req.user.id);
  }
  
  db.get(checkQuery, checkParams, (err, subject) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }
    
    db.run(
      `INSERT INTO attendance_sessions (subject_id, session_name, date, start_time, end_time, location, session_type, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_id, session_name, date, start_time, end_time, location, session_type, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create session' });
        }
        
        // Get the created session with subject info
        const query = `
          SELECT ats.*, s.name as subject_name, s.code as subject_code, u.name as created_by_name
          FROM attendance_sessions ats
          JOIN subjects s ON ats.subject_id = s.id
          LEFT JOIN users u ON ats.created_by = u.id
          WHERE ats.id = ?
        `;
        
        db.get(query, [this.lastID], (err, session) => {
          if (err) {
            return res.status(500).json({ error: 'Session created but failed to retrieve' });
          }
          
          // Emit real-time update
          req.io.emit('session-created', session);
          
          res.status(201).json({
            message: 'Attendance session created successfully',
            session
          });
        });
      }
    );
  });
});

// Get attendance records for a session
router.get('/sessions/:id/records', authenticateToken, (req, res) => {
  const db = getDatabase();
  const sessionId = req.params.id;
  
  const query = `
    SELECT ar.*, s.name as student_name, s.enrollment_no, s.photo_path, u.name as marked_by_name
    FROM attendance_records ar
    JOIN students s ON ar.student_id = s.id
    LEFT JOIN users u ON ar.marked_by = u.id
    WHERE ar.session_id = ?
    ORDER BY s.name ASC
  `;
  
  db.all(query, [sessionId], (err, records) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(records);
  });
});

// Mark attendance for a session
router.post('/sessions/:id/records', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const sessionId = req.params.id;
  const { student_id, status = 'present', method = 'manual', confidence_score, notes } = req.body;
  
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }
  
  const db = getDatabase();
  
  // Verify session exists and user has access
  const sessionQuery = `
    SELECT ats.*, s.teacher_id
    FROM attendance_sessions ats
    JOIN subjects s ON ats.subject_id = s.id
    WHERE ats.id = ? AND ats.is_active = 1
  `;
  
  db.get(sessionQuery, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role === 'teacher' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Insert or update attendance record
    db.run(
      `INSERT OR REPLACE INTO attendance_records 
       (session_id, student_id, status, marked_by, method, confidence_score, notes, marked_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [sessionId, student_id, status, req.user.id, method, confidence_score, notes],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to mark attendance' });
        }
        
        // Get the created/updated record with student info
        const query = `
          SELECT ar.*, s.name as student_name, s.enrollment_no, s.photo_path, u.name as marked_by_name
          FROM attendance_records ar
          JOIN students s ON ar.student_id = s.id
          LEFT JOIN users u ON ar.marked_by = u.id
          WHERE ar.session_id = ? AND ar.student_id = ?
        `;
        
        db.get(query, [sessionId, student_id], (err, record) => {
          if (err) {
            return res.status(500).json({ error: 'Attendance marked but failed to retrieve' });
          }
          
          // Emit real-time update
          req.io.to(`session-${sessionId}`).emit('attendance-marked', record);
          
          res.json({
            message: 'Attendance marked successfully',
            record
          });
        });
      }
    );
  });
});

// Bulk mark attendance
router.post('/sessions/:id/bulk-records', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const sessionId = req.params.id;
  const { records } = req.body; // Array of { student_id, status, method, confidence_score, notes }
  
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  const db = getDatabase();
  
  // Verify session exists and user has access
  const sessionQuery = `
    SELECT ats.*, s.teacher_id
    FROM attendance_sessions ats
    JOIN subjects s ON ats.subject_id = s.id
    WHERE ats.id = ? AND ats.is_active = 1
  `;
  
  db.get(sessionQuery, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role === 'teacher' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let completed = 0;
      let errors = [];
      
      records.forEach((record, index) => {
        const { student_id, status = 'present', method = 'manual', confidence_score, notes } = record;
        
        db.run(
          `INSERT OR REPLACE INTO attendance_records 
           (session_id, student_id, status, marked_by, method, confidence_score, notes, marked_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [sessionId, student_id, status, req.user.id, method, confidence_score, notes],
          function(err) {
            completed++;
            
            if (err) {
              errors.push({ index, student_id, error: err.message });
            }
            
            if (completed === records.length) {
              if (errors.length > 0) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                  error: 'Some records failed to save', 
                  errors 
                });
              }
              
              db.run('COMMIT', (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Failed to commit transaction' });
                }
                
                // Emit real-time update
                req.io.to(`session-${sessionId}`).emit('bulk-attendance-marked', { sessionId, count: records.length });
                
                res.json({
                  message: `${records.length} attendance records marked successfully`
                });
              });
            }
          }
        );
      });
    });
  });
});

// Get attendance statistics
router.get('/stats', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { subject_id, student_id, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      COUNT(DISTINCT ats.id) as total_sessions,
      COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) as present_count,
      COUNT(DISTINCT CASE WHEN ar.status = 'absent' THEN ar.id END) as absent_count,
      COUNT(DISTINCT CASE WHEN ar.status = 'late' THEN ar.id END) as late_count,
      ROUND(
        (COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) * 100.0 / 
         NULLIF(COUNT(DISTINCT ats.id), 0)), 2
      ) as attendance_percentage
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ats.id = ar.session_id
    JOIN subjects s ON ats.subject_id = s.id
    WHERE ats.is_active = 1
  `;
  const params = [];
  
  if (subject_id) {
    query += ' AND ats.subject_id = ?';
    params.push(subject_id);
  }
  
  if (student_id) {
    query += ' AND ar.student_id = ?';
    params.push(student_id);
  }
  
  if (start_date) {
    query += ' AND ats.date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND ats.date <= ?';
    params.push(end_date);
  }
  
  // Filter by teacher's subjects if not admin
  if (req.user.role === 'teacher') {
    query += ' AND s.teacher_id = ?';
    params.push(req.user.id);
  }
  
  db.get(query, params, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(stats);
  });
});

module.exports = router;