const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/students');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  }
});

// Get all students
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { department, year, search } = req.query;
  
  let query = 'SELECT * FROM students WHERE is_active = 1';
  const params = [];
  
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }
  
  if (year) {
    query += ' AND year = ?';
    params.push(year);
  }
  
  if (search) {
    query += ' AND (name LIKE ? OR enrollment_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY name ASC';
  
  db.all(query, params, (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(students);
  });
});

// Get student by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT * FROM students WHERE id = ?', [req.params.id], (err, student) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(student);
  });
});

// Create new student
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { enrollment_no, name, email, phone, department, year } = req.body;
    
    if (!enrollment_no || !name) {
      return res.status(400).json({ error: 'Enrollment number and name are required' });
    }
    
    const db = getDatabase();
    const photo_path = req.file ? `/uploads/students/${req.file.filename}` : null;
    
    db.run(
      `INSERT INTO students (enrollment_no, name, email, phone, department, year, photo_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [enrollment_no, name, email, phone, department, year, photo_path],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Student with this enrollment number already exists' });
          }
          return res.status(500).json({ error: 'Failed to create student' });
        }
        
        // Get the created student
        db.get('SELECT * FROM students WHERE id = ?', [this.lastID], (err, student) => {
          if (err) {
            return res.status(500).json({ error: 'Student created but failed to retrieve' });
          }
          
          // Emit real-time update
          req.io.emit('student-created', student);
          
          res.status(201).json({
            message: 'Student created successfully',
            student
          });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update student
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { enrollment_no, name, email, phone, department, year } = req.body;
    const studentId = req.params.id;
    
    const db = getDatabase();
    
    // Get current student data
    db.get('SELECT * FROM students WHERE id = ?', [studentId], async (err, currentStudent) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!currentStudent) {
        return res.status(404).json({ error: 'Student not found' });
      }
      
      let photo_path = currentStudent.photo_path;
      
      // Handle new photo upload
      if (req.file) {
        photo_path = `/uploads/students/${req.file.filename}`;
        
        // Delete old photo if exists
        if (currentStudent.photo_path) {
          try {
            await fs.unlink(path.join(__dirname, '..', currentStudent.photo_path));
          } catch (error) {
            console.log('Failed to delete old photo:', error);
          }
        }
      }
      
      db.run(
        `UPDATE students 
         SET enrollment_no = ?, name = ?, email = ?, phone = ?, department = ?, year = ?, photo_path = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [enrollment_no, name, email, phone, department, year, photo_path, studentId],
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              return res.status(400).json({ error: 'Student with this enrollment number already exists' });
            }
            return res.status(500).json({ error: 'Failed to update student' });
          }
          
          // Get updated student
          db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, student) => {
            if (err) {
              return res.status(500).json({ error: 'Student updated but failed to retrieve' });
            }
            
            // Emit real-time update
            req.io.emit('student-updated', student);
            
            res.json({
              message: 'Student updated successfully',
              student
            });
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete student
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;
    const db = getDatabase();
    
    // Get student data for photo cleanup
    db.get('SELECT * FROM students WHERE id = ?', [studentId], async (err, student) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
      
      // Soft delete (mark as inactive)
      db.run(
        'UPDATE students SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [studentId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete student' });
          }
          
          // Emit real-time update
          req.io.emit('student-deleted', { id: studentId });
          
          res.json({ message: 'Student deleted successfully' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get student's attendance summary
router.get('/:id/attendance', authenticateToken, (req, res) => {
  const db = getDatabase();
  const studentId = req.params.id;
  
  const query = `
    SELECT 
      s.name as subject_name,
      s.code as subject_code,
      COUNT(ar.id) as total_sessions,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
      ROUND((SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(ar.id)), 2) as attendance_percentage
    FROM student_subjects ss
    JOIN subjects s ON ss.subject_id = s.id
    LEFT JOIN attendance_sessions ats ON s.id = ats.subject_id
    LEFT JOIN attendance_records ar ON ats.id = ar.session_id AND ar.student_id = ?
    WHERE ss.student_id = ? AND ss.is_active = 1
    GROUP BY s.id, s.name, s.code
    ORDER BY s.name
  `;
  
  db.all(query, [studentId, studentId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

module.exports = router;