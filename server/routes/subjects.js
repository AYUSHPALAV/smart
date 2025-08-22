const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all subjects
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { department, year, teacher_id } = req.query;
  
  let query = `
    SELECT s.*, u.name as teacher_name 
    FROM subjects s 
    LEFT JOIN users u ON s.teacher_id = u.id 
    WHERE s.is_active = 1
  `;
  const params = [];
  
  if (department) {
    query += ' AND s.department = ?';
    params.push(department);
  }
  
  if (year) {
    query += ' AND s.year = ?';
    params.push(year);
  }
  
  if (teacher_id) {
    query += ' AND s.teacher_id = ?';
    params.push(teacher_id);
  }
  
  query += ' ORDER BY s.name ASC';
  
  db.all(query, params, (err, subjects) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(subjects);
  });
});

// Get subject by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const query = `
    SELECT s.*, u.name as teacher_name 
    FROM subjects s 
    LEFT JOIN users u ON s.teacher_id = u.id 
    WHERE s.id = ?
  `;
  
  db.get(query, [req.params.id], (err, subject) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(subject);
  });
});

// Create new subject
router.post('/', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const { code, name, description, department, year, semester } = req.body;
  
  if (!code || !name) {
    return res.status(400).json({ error: 'Subject code and name are required' });
  }
  
  const db = getDatabase();
  const teacher_id = req.user.role === 'admin' ? req.body.teacher_id : req.user.id;
  
  db.run(
    `INSERT INTO subjects (code, name, description, teacher_id, department, year, semester) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code, name, description, teacher_id, department, year, semester],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Subject with this code already exists' });
        }
        return res.status(500).json({ error: 'Failed to create subject' });
      }
      
      // Get the created subject with teacher info
      const query = `
        SELECT s.*, u.name as teacher_name 
        FROM subjects s 
        LEFT JOIN users u ON s.teacher_id = u.id 
        WHERE s.id = ?
      `;
      
      db.get(query, [this.lastID], (err, subject) => {
        if (err) {
          return res.status(500).json({ error: 'Subject created but failed to retrieve' });
        }
        
        // Emit real-time update
        req.io.emit('subject-created', subject);
        
        res.status(201).json({
          message: 'Subject created successfully',
          subject
        });
      });
    }
  );
});

// Update subject
router.put('/:id', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const { code, name, description, department, year, semester } = req.body;
  const subjectId = req.params.id;
  
  const db = getDatabase();
  
  // Check if user can edit this subject
  let checkQuery = 'SELECT * FROM subjects WHERE id = ?';
  let checkParams = [subjectId];
  
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
    
    const teacher_id = req.user.role === 'admin' ? req.body.teacher_id || subject.teacher_id : subject.teacher_id;
    
    db.run(
      `UPDATE subjects 
       SET code = ?, name = ?, description = ?, teacher_id = ?, department = ?, year = ?, semester = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [code, name, description, teacher_id, department, year, semester, subjectId],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Subject with this code already exists' });
          }
          return res.status(500).json({ error: 'Failed to update subject' });
        }
        
        // Get updated subject with teacher info
        const query = `
          SELECT s.*, u.name as teacher_name 
          FROM subjects s 
          LEFT JOIN users u ON s.teacher_id = u.id 
          WHERE s.id = ?
        `;
        
        db.get(query, [subjectId], (err, updatedSubject) => {
          if (err) {
            return res.status(500).json({ error: 'Subject updated but failed to retrieve' });
          }
          
          // Emit real-time update
          req.io.emit('subject-updated', updatedSubject);
          
          res.json({
            message: 'Subject updated successfully',
            subject: updatedSubject
          });
        });
      }
    );
  });
});

// Delete subject
router.delete('/:id', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const subjectId = req.params.id;
  const db = getDatabase();
  
  // Check if user can delete this subject
  let checkQuery = 'SELECT * FROM subjects WHERE id = ?';
  let checkParams = [subjectId];
  
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
    
    // Soft delete
    db.run(
      'UPDATE subjects SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [subjectId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete subject' });
        }
        
        // Emit real-time update
        req.io.emit('subject-deleted', { id: subjectId });
        
        res.json({ message: 'Subject deleted successfully' });
      }
    );
  });
});

// Get students enrolled in a subject
router.get('/:id/students', authenticateToken, (req, res) => {
  const db = getDatabase();
  const subjectId = req.params.id;
  
  const query = `
    SELECT s.*, ss.enrolled_at
    FROM students s
    JOIN student_subjects ss ON s.id = ss.student_id
    WHERE ss.subject_id = ? AND ss.is_active = 1 AND s.is_active = 1
    ORDER BY s.name ASC
  `;
  
  db.all(query, [subjectId], (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(students);
  });
});

// Enroll student in subject
router.post('/:id/students', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const { student_id } = req.body;
  const subjectId = req.params.id;
  
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT OR REPLACE INTO student_subjects (student_id, subject_id, is_active) VALUES (?, ?, 1)',
    [student_id, subjectId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to enroll student' });
      }
      
      res.json({ message: 'Student enrolled successfully' });
    }
  );
});

// Remove student from subject
router.delete('/:id/students/:studentId', authenticateToken, requireRole(['admin', 'teacher']), (req, res) => {
  const { id: subjectId, studentId } = req.params;
  const db = getDatabase();
  
  db.run(
    'UPDATE student_subjects SET is_active = 0 WHERE student_id = ? AND subject_id = ?',
    [studentId, subjectId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to remove student' });
      }
      
      res.json({ message: 'Student removed successfully' });
    }
  );
});

module.exports = router;