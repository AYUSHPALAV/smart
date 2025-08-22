import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, subjectsApi, studentsApi } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import moment from 'moment';

const AttendanceList: React.FC = () => {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['attendance-sessions'],
    queryFn: () => attendanceApi.getSessions({ limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage attendance sessions and records
          </p>
        </div>
        <button
          onClick={() => setShowCreateSession(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Session
        </button>
      </div>

      {/* Sessions List */}
      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions?.data?.map((session: any) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {session.session_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Created by {session.created_by_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {session.subject_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.subject_code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {moment(session.date).format('MMM DD, YYYY')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.start_time && session.end_time
                          ? `${session.start_time} - ${session.end_time}`
                          : session.start_time || 'No time set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="badge badge-info">
                        {session.session_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedSession(session.id)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Mark Attendance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sessions?.data?.length === 0 && (
            <div className="text-center py-12">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new attendance session.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateSession && (
        <CreateSessionModal
          onClose={() => setShowCreateSession(false)}
          onSuccess={() => {
            setShowCreateSession(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
          }}
        />
      )}

      {/* Mark Attendance Modal */}
      {selectedSession && (
        <MarkAttendanceModal
          sessionId={selectedSession}
          onClose={() => setSelectedSession(null)}
          onSuccess={() => {
            setSelectedSession(null);
            queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
          }}
        />
      )}
    </div>
  );
};

const CreateSessionModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    subject_id: '',
    session_name: '',
    date: moment().format('YYYY-MM-DD'),
    start_time: '',
    end_time: '',
    location: '',
    session_type: 'lecture',
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: attendanceApi.createSession,
    onSuccess: () => {
      toast.success('Session created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create session');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      subject_id: parseInt(formData.subject_id),
    };
    
    createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create Attendance Session</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Subject *
              </label>
              <select
                required
                className="mt-1 input"
                value={formData.subject_id}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              >
                <option value="">Select Subject</option>
                {subjects?.data?.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Session Name *
              </label>
              <input
                type="text"
                required
                className="mt-1 input"
                value={formData.session_name}
                onChange={(e) => setFormData({ ...formData, session_name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <input
                type="date"
                required
                className="mt-1 input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <input
                  type="time"
                  className="mt-1 input"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Time
                </label>
                <input
                  type="time"
                  className="mt-1 input"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Session Type
              </label>
              <select
                className="mt-1 input"
                value={formData.session_type}
                onChange={(e) => setFormData({ ...formData, session_type: e.target.value })}
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="tutorial">Tutorial</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                className="mt-1 input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  'Create Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const MarkAttendanceModal: React.FC<{
  sessionId: number;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ sessionId, onClose, onSuccess }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ['attendance-session', sessionId],
    queryFn: () => attendanceApi.getSession(sessionId),
  });

  const { data: students } = useQuery({
    queryKey: ['subject-students', session?.data?.subject_id],
    queryFn: () => subjectsApi.getStudents(session?.data?.subject_id),
    enabled: !!session?.data?.subject_id,
  });

  const { data: existingRecords } = useQuery({
    queryKey: ['session-records', sessionId],
    queryFn: () => attendanceApi.getSessionRecords(sessionId),
  });

  const bulkMarkMutation = useMutation({
    mutationFn: (records: any[]) => attendanceApi.bulkMarkAttendance(sessionId, records),
    onSuccess: () => {
      toast.success('Attendance marked successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to mark attendance');
    },
  });

  // Initialize attendance records with existing data
  React.useEffect(() => {
    if (existingRecords?.data) {
      const records: Record<number, string> = {};
      existingRecords.data.forEach((record: any) => {
        records[record.student_id] = record.status;
      });
      setAttendanceRecords(records);
    }
  }, [existingRecords]);

  const handleStatusChange = (studentId: number, status: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmit = () => {
    const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
      student_id: parseInt(studentId),
      status,
      method: 'manual',
    }));

    bulkMarkMutation.mutate(records);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Mark Attendance - {session?.data?.session_name}
              </h3>
              <p className="text-sm text-gray-500">
                {session?.data?.subject_name} ({session?.data?.subject_code})
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enrollment No
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students?.data?.map((student: any) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          {student.photo_path ? (
                            <img
                              className="h-8 w-8 rounded-full object-cover"
                              src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${student.photo_path}`}
                              alt={student.name}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-700">
                                {student.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {student.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.enrollment_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="radio"
                        name={`attendance-${student.id}`}
                        value="present"
                        checked={attendanceRecords[student.id] === 'present'}
                        onChange={() => handleStatusChange(student.id, 'present')}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="radio"
                        name={`attendance-${student.id}`}
                        value="absent"
                        checked={attendanceRecords[student.id] === 'absent'}
                        onChange={() => handleStatusChange(student.id, 'absent')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="radio"
                        name={`attendance-${student.id}`}
                        value="late"
                        checked={attendanceRecords[student.id] === 'late'}
                        onChange={() => handleStatusChange(student.id, 'late')}
                        className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={bulkMarkMutation.isPending}
              className="btn-primary"
            >
              {bulkMarkMutation.isPending ? (
                <LoadingSpinner size="sm" className="text-white" />
              ) : (
                'Save Attendance'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Attendance: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AttendanceList />} />
    </Routes>
  );
};