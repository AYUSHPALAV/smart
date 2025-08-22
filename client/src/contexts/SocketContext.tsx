import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
        auth: {
          token,
        },
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      // Listen for real-time updates
      newSocket.on('student-created', (student) => {
        toast.success(`New student registered: ${student.name}`);
      });

      newSocket.on('student-updated', (student) => {
        toast.success(`Student updated: ${student.name}`);
      });

      newSocket.on('student-deleted', (data) => {
        toast.success('Student removed');
      });

      newSocket.on('subject-created', (subject) => {
        toast.success(`New subject created: ${subject.name}`);
      });

      newSocket.on('subject-updated', (subject) => {
        toast.success(`Subject updated: ${subject.name}`);
      });

      newSocket.on('subject-deleted', (data) => {
        toast.success('Subject removed');
      });

      newSocket.on('session-created', (session) => {
        toast.success(`New attendance session: ${session.session_name}`);
      });

      newSocket.on('attendance-marked', (record) => {
        toast.success(`Attendance marked for ${record.student_name}`);
      });

      newSocket.on('bulk-attendance-marked', (data) => {
        toast.success(`Bulk attendance marked: ${data.count} records`);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, token]);

  const value = {
    socket,
    isConnected,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};