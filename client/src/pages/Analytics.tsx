import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, subjectsApi } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import moment from 'moment';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const Analytics: React.FC = () => {
  const [filters, setFilters] = useState({
    period: '30',
    subject_id: '',
    start_date: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    end_date: moment().format('YYYY-MM-DD'),
    format: 'summary',
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAll(),
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard', filters.period],
    queryFn: () => analyticsApi.getDashboard({ period: parseInt(filters.period) }),
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-trends', filters.period, filters.subject_id],
    queryFn: () => analyticsApi.getTrends({
      period: parseInt(filters.period),
      group_by: 'day',
      subject_id: filters.subject_id ? parseInt(filters.subject_id) : undefined,
    }),
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['analytics-report', filters],
    queryFn: () => analyticsApi.getReport({
      start_date: filters.start_date,
      end_date: filters.end_date,
      subject_id: filters.subject_id ? parseInt(filters.subject_id) : undefined,
      format: filters.format as 'summary' | 'detailed',
    }),
  });

  const stats = dashboardData?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Detailed insights and reports on attendance data
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period (Days)
              </label>
              <select
                className="input"
                value={filters.period}
                onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <select
                className="input"
                value={filters.subject_id}
                onChange={(e) => setFilters({ ...filters, subject_id: e.target.value })}
              >
                <option value="">All Subjects</option>
                {subjects?.data?.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="input"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                className="input"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Format
              </label>
              <select
                className="input"
                value={filters.format}
                onChange={(e) => setFilters({ ...filters, format: e.target.value })}
              >
                <option value="summary">Summary</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      {dashboardLoading ? (
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-primary-600">
                {stats?.totalStudents || 0}
              </div>
              <div className="text-sm text-gray-500">Total Students</div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-success-600">
                {stats?.totalSessions || 0}
              </div>
              <div className="text-sm text-gray-500">Total Sessions</div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-warning-600">
                {stats?.attendanceOverview?.total_records || 0}
              </div>
              <div className="text-sm text-gray-500">Total Records</div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-purple-600">
                {stats?.attendanceOverview?.attendance_percentage || 0}%
              </div>
              <div className="text-sm text-gray-500">Avg Attendance</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Attendance Trends
            </h3>
          </div>
          <div className="card-body">
            {trendsLoading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsData?.data?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="attendance_percentage"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Attendance %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Subject-wise Performance */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Subject-wise Performance
            </h3>
          </div>
          <div className="card-body">
            {dashboardLoading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.subjectWise || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject_code" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="attendance_percentage" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Report */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">
            Attendance Report ({filters.format})
          </h3>
          <p className="text-sm text-gray-500">
            {moment(filters.start_date).format('MMM DD, YYYY')} - {moment(filters.end_date).format('MMM DD, YYYY')}
          </p>
        </div>
        <div className="card-body">
          {reportLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="lg" />
            </div>
          ) : reportData?.data?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {filters.format === 'summary' ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Sessions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Present
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Absent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Attendance %
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Session
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Method
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.data.data.map((record: any, index: number) => (
                    <tr key={index}>
                      {filters.format === 'summary' ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {record.student_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {record.enrollment_no}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {record.subject_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {record.subject_code}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.total_sessions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-success-600">
                            {record.present_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-error-600">
                            {record.absent_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.attendance_percentage >= 75
                                ? 'bg-success-100 text-success-800'
                                : record.attendance_percentage >= 50
                                ? 'bg-warning-100 text-warning-800'
                                : 'bg-error-100 text-error-800'
                            }`}>
                              {record.attendance_percentage}%
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {moment(record.date).format('MMM DD, YYYY')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.session_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {record.student_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {record.enrollment_no}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {record.subject_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {record.subject_code}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`badge ${
                              record.status === 'present'
                                ? 'badge-success'
                                : record.status === 'late'
                                ? 'badge-warning'
                                : 'badge-error'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.method}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};