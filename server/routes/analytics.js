const express = require('express');
const moment = require('moment');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { period = '30' } = req.query; // days
  
  const startDate = moment().subtract(parseInt(period), 'days').format('YYYY-MM-DD');
  
  // Build base query conditions based on user role
  let subjectCondition = '';
  let params = [startDate];
  
  if (req.user.role === 'teacher') {
    subjectCondition = ' AND s.teacher_id = ?';
    params.push(req.user.id);
  }
  
  const queries = {
    // Total counts
    totalStudents: `
      SELECT COUNT(DISTINCT st.id) as count
      FROM students st
      JOIN student_subjects ss ON st.id = ss.student_id
      JOIN subjects s ON ss.subject_id = s.id
      WHERE st.is_active = 1 AND ss.is_active = 1 ${subjectCondition}
    `,
    
    totalSubjects: `
      SELECT COUNT(*) as count
      FROM subjects s
      WHERE s.is_active = 1 ${subjectCondition}
    `,
    
    totalSessions: `
      SELECT COUNT(*) as count
      FROM attendance_sessions ats
      JOIN subjects s ON ats.subject_id = s.id
      WHERE ats.is_active = 1 AND ats.date >= ? ${subjectCondition}
    `,
    
    // Attendance overview
    attendanceOverview: `
      SELECT 
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND(
          (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(ar.id), 0)), 2
        ) as attendance_percentage
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      JOIN subjects s ON ats.subject_id = s.id
      WHERE ats.date >= ? ${subjectCondition}
    `,
    
    // Daily attendance trend
    dailyTrend: `
      SELECT 
        ats.date,
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(
          (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(ar.id), 0)), 2
        ) as attendance_percentage
      FROM attendance_sessions ats
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id
      JOIN subjects s ON ats.subject_id = s.id
      WHERE ats.date >= ? ${subjectCondition}
      GROUP BY ats.date
      ORDER BY ats.date ASC
    `,
    
    // Subject-wise attendance
    subjectWise: `
      SELECT 
        s.name as subject_name,
        s.code as subject_code,
        COUNT(DISTINCT ats.id) as total_sessions,
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(
          (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(ar.id), 0)), 2
        ) as attendance_percentage
      FROM subjects s
      LEFT JOIN attendance_sessions ats ON s.id = ats.subject_id AND ats.date >= ?
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id
      WHERE s.is_active = 1 ${subjectCondition}
      GROUP BY s.id, s.name, s.code
      ORDER BY attendance_percentage DESC
    `,
    
    // Low attendance students
    lowAttendanceStudents: `
      SELECT 
        st.name as student_name,
        st.enrollment_no,
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(
          (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(ar.id), 0)), 2
        ) as attendance_percentage
      FROM students st
      JOIN student_subjects ss ON st.id = ss.student_id
      JOIN subjects s ON ss.subject_id = s.id
      LEFT JOIN attendance_sessions ats ON s.id = ats.subject_id AND ats.date >= ?
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id AND ar.student_id = st.id
      WHERE st.is_active = 1 AND ss.is_active = 1 ${subjectCondition}
      GROUP BY st.id, st.name, st.enrollment_no
      HAVING COUNT(ar.id) > 0 AND attendance_percentage < 75
      ORDER BY attendance_percentage ASC
      LIMIT 10
    `
  };
  
  const results = {};
  const queryKeys = Object.keys(queries);
  let completed = 0;
  
  queryKeys.forEach(key => {
    db.all(queries[key], params, (err, data) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        results[key] = key === 'attendanceOverview' ? {} : [];
      } else {
        if (key === 'totalStudents' || key === 'totalSubjects' || key === 'totalSessions') {
          results[key] = data[0]?.count || 0;
        } else if (key === 'attendanceOverview') {
          results[key] = data[0] || {};
        } else {
          results[key] = data || [];
        }
      }
      
      completed++;
      if (completed === queryKeys.length) {
        res.json(results);
      }
    });
  });
});

// Get attendance report for a specific period
router.get('/report', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { 
    start_date, 
    end_date, 
    subject_id, 
    student_id, 
    department, 
    year,
    format = 'summary' // summary, detailed
  } = req.query;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }
  
  let query, params;
  
  if (format === 'detailed') {
    // Detailed report with individual records
    query = `
      SELECT 
        ats.date,
        ats.session_name,
        ats.session_type,
        s.name as subject_name,
        s.code as subject_code,
        st.name as student_name,
        st.enrollment_no,
        st.department,
        st.year,
        ar.status,
        ar.marked_at,
        ar.method,
        u.name as marked_by_name
      FROM attendance_sessions ats
      JOIN subjects s ON ats.subject_id = s.id
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id
      LEFT JOIN students st ON ar.student_id = st.id
      LEFT JOIN users u ON ar.marked_by = u.id
      WHERE ats.date BETWEEN ? AND ? AND ats.is_active = 1
    `;
    params = [start_date, end_date];
  } else {
    // Summary report
    query = `
      SELECT 
        st.name as student_name,
        st.enrollment_no,
        st.department,
        st.year,
        s.name as subject_name,
        s.code as subject_code,
        COUNT(DISTINCT ats.id) as total_sessions,
        COUNT(ar.id) as attended_sessions,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND(
          (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(DISTINCT ats.id), 0)), 2
        ) as attendance_percentage
      FROM students st
      JOIN student_subjects ss ON st.id = ss.student_id
      JOIN subjects s ON ss.subject_id = s.id
      LEFT JOIN attendance_sessions ats ON s.id = ats.subject_id 
        AND ats.date BETWEEN ? AND ? AND ats.is_active = 1
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id AND ar.student_id = st.id
      WHERE st.is_active = 1 AND ss.is_active = 1
    `;
    params = [start_date, end_date];
  }
  
  // Add filters
  if (subject_id) {
    query += ' AND s.id = ?';
    params.push(subject_id);
  }
  
  if (student_id) {
    query += ' AND st.id = ?';
    params.push(student_id);
  }
  
  if (department) {
    query += ' AND st.department = ?';
    params.push(department);
  }
  
  if (year) {
    query += ' AND st.year = ?';
    params.push(year);
  }
  
  // Filter by teacher's subjects if not admin
  if (req.user.role === 'teacher') {
    query += ' AND s.teacher_id = ?';
    params.push(req.user.id);
  }
  
  if (format === 'summary') {
    query += ' GROUP BY st.id, s.id ORDER BY st.name, s.name';
  } else {
    query += ' ORDER BY ats.date DESC, ats.session_name, st.name';
  }
  
  db.all(query, params, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      period: { start_date, end_date },
      format,
      total_records: data.length,
      data
    });
  });
});

// Get attendance trends
router.get('/trends', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { 
    period = '30', // days
    group_by = 'day', // day, week, month
    subject_id 
  } = req.query;
  
  const startDate = moment().subtract(parseInt(period), 'days').format('YYYY-MM-DD');
  
  let dateFormat, groupBy;
  switch (group_by) {
    case 'week':
      dateFormat = '%Y-%W';
      groupBy = "strftime('%Y-%W', ats.date)";
      break;
    case 'month':
      dateFormat = '%Y-%m';
      groupBy = "strftime('%Y-%m', ats.date)";
      break;
    default:
      dateFormat = '%Y-%m-%d';
      groupBy = 'ats.date';
  }
  
  let query = `
    SELECT 
      ${groupBy} as period,
      COUNT(DISTINCT ats.id) as total_sessions,
      COUNT(ar.id) as total_records,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
      ROUND(
        (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
         NULLIF(COUNT(ar.id), 0)), 2
      ) as attendance_percentage
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ats.id = ar.session_id
    JOIN subjects s ON ats.subject_id = s.id
    WHERE ats.date >= ? AND ats.is_active = 1
  `;
  
  const params = [startDate];
  
  if (subject_id) {
    query += ' AND ats.subject_id = ?';
    params.push(subject_id);
  }
  
  // Filter by teacher's subjects if not admin
  if (req.user.role === 'teacher') {
    query += ' AND s.teacher_id = ?';
    params.push(req.user.id);
  }
  
  query += ` GROUP BY ${groupBy} ORDER BY period ASC`;
  
  db.all(query, params, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      period: parseInt(period),
      group_by,
      data
    });
  });
});

module.exports = router;