import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SubjectsList: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: subjectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete subject');
    },
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage subjects and course information
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Subject
        </button>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects?.data?.map((subject: any) => (
          <div key={subject.id} className="card">
            <div className="card-body">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {subject.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    Code: {subject.code}
                  </p>
                  {subject.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {subject.description}
                    </p>
                  )}
                  <div className="space-y-1 text-sm text-gray-500">
                    {subject.teacher_name && (
                      <p>Teacher: {subject.teacher_name}</p>
                    )}
                    {subject.department && (
                      <p>Department: {subject.department}</p>
                    )}
                    {subject.year && (
                      <p>Year: {subject.year}</p>
                    )}
                    {subject.semester && (
                      <p>Semester: {subject.semester}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleDelete(subject.id, subject.name)}
                    className="text-red-600 hover:text-red-900 text-sm"
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {subjects?.data?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No subjects found</p>
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddForm && (
        <AddSubjectModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
          }}
        />
      )}
    </div>
  );
};

const AddSubjectModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    department: '',
    year: '',
    semester: '',
  });

  const createMutation = useMutation({
    mutationFn: subjectsApi.create,
    onSuccess: () => {
      toast.success('Subject created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create subject');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      year: formData.year ? parseInt(formData.year) : undefined,
      semester: formData.semester ? parseInt(formData.semester) : undefined,
    };
    
    createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Subject</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Subject Code *
              </label>
              <input
                type="text"
                required
                className="mt-1 input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Subject Name *
              </label>
              <input
                type="text"
                required
                className="mt-1 input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                className="mt-1 input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                className="mt-1 input"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Year
                </label>
                <select
                  className="mt-1 input"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                >
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semester
                </label>
                <select
                  className="mt-1 input"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                >
                  <option value="">Select Semester</option>
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                </select>
              </div>
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
                  'Add Subject'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const Subjects: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<SubjectsList />} />
    </Routes>
  );
};