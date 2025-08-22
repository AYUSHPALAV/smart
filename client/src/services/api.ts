import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string, role?: string) =>
    api.post('/auth/register', { email, password, name, role }),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Students API
export const studentsApi = {
  getAll: (params?: { department?: string; year?: number; search?: string }) =>
    api.get('/students', { params }),
  getById: (id: number) => api.get(`/students/${id}`),
  create: (data: FormData) => api.post('/students', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id: number, data: FormData) => api.put(`/students/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id: number) => api.delete(`/students/${id}`),
  getAttendance: (id: number) => api.get(`/students/${id}/attendance`),
};

// Subjects API
export const subjectsApi = {
  getAll: (params?: { department?: string; year?: number; teacher_id?: number }) =>
    api.get('/subjects', { params }),
  getById: (id: number) => api.get(`/subjects/${id}`),
  create: (data: any) => api.post('/subjects', data),
  update: (id: number, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: number) => api.delete(`/subjects/${id}`),
  getStudents: (id: number) => api.get(`/subjects/${id}/students`),
  enrollStudent: (id: number, studentId: number) =>
    api.post(`/subjects/${id}/students`, { student_id: studentId }),
  removeStudent: (id: number, studentId: number) =>
    api.delete(`/subjects/${id}/students/${studentId}`),
};

// Attendance API
export const attendanceApi = {
  getSessions: (params?: { subject_id?: number; date?: string; limit?: number }) =>
    api.get('/attendance/sessions', { params }),
  getSession: (id: number) => api.get(`/attendance/sessions/${id}`),
  createSession: (data: any) => api.post('/attendance/sessions', data),
  getSessionRecords: (sessionId: number) =>
    api.get(`/attendance/sessions/${sessionId}/records`),
  markAttendance: (sessionId: number, data: any) =>
    api.post(`/attendance/sessions/${sessionId}/records`, data),
  bulkMarkAttendance: (sessionId: number, records: any[]) =>
    api.post(`/attendance/sessions/${sessionId}/bulk-records`, { records }),
  getStats: (params?: { subject_id?: number; student_id?: number; start_date?: string; end_date?: string }) =>
    api.get('/attendance/stats', { params }),
};

// Analytics API
export const analyticsApi = {
  getDashboard: (params?: { period?: number }) =>
    api.get('/analytics/dashboard', { params }),
  getReport: (params: {
    start_date: string;
    end_date: string;
    subject_id?: number;
    student_id?: number;
    department?: string;
    year?: number;
    format?: 'summary' | 'detailed';
  }) => api.get('/analytics/report', { params }),
  getTrends: (params?: { period?: number; group_by?: 'day' | 'week' | 'month'; subject_id?: number }) =>
    api.get('/analytics/trends', { params }),
};

export default api;