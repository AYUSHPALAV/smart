# Smart Attendance Management System

A comprehensive web-based attendance management system with face recognition capabilities, real-time updates, and advanced analytics.

## Features

### Core Features
- **User Authentication & Authorization**: Role-based access control (Admin/Teacher)
- **Student Management**: Complete CRUD operations with photo uploads
- **Subject Management**: Course and subject administration
- **Attendance Sessions**: Create and manage attendance sessions
- **Real-time Updates**: Live notifications using Socket.IO
- **Analytics & Reporting**: Comprehensive attendance analytics and reports

### Advanced Features
- **Face Recognition**: Integration ready for face detection and recognition
- **Bulk Operations**: Bulk attendance marking and data import/export
- **Mobile Responsive**: Works seamlessly on all devices
- **Data Visualization**: Charts and graphs for attendance trends
- **Export Capabilities**: Generate reports in various formats

## Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database with proper indexing
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **Multer** for file uploads
- **bcryptjs** for password hashing

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **React Router** for navigation
- **Recharts** for data visualization
- **React Hook Form** for form handling

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Backend Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm run server
   ```

The server will run on `http://localhost:3001`

### Frontend Setup
1. Navigate to client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The client will run on `http://localhost:5173`

### Full Development Setup
Run both backend and frontend concurrently:
```bash
npm run dev
```

## Database Schema

The system uses SQLite with the following main tables:
- **users**: System users (teachers/admins)
- **students**: Student information and photos
- **subjects**: Course subjects
- **attendance_sessions**: Attendance session records
- **attendance_records**: Individual attendance entries
- **student_subjects**: Student-subject enrollment mapping

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Create new student
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Subjects
- `GET /api/subjects` - Get all subjects
- `POST /api/subjects` - Create new subject
- `GET /api/subjects/:id` - Get subject by ID
- `PUT /api/subjects/:id` - Update subject
- `DELETE /api/subjects/:id` - Delete subject

### Attendance
- `GET /api/attendance/sessions` - Get attendance sessions
- `POST /api/attendance/sessions` - Create attendance session
- `GET /api/attendance/sessions/:id/records` - Get session records
- `POST /api/attendance/sessions/:id/records` - Mark attendance
- `POST /api/attendance/sessions/:id/bulk-records` - Bulk mark attendance

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard analytics
- `GET /api/analytics/report` - Generate attendance reports
- `GET /api/analytics/trends` - Get attendance trends

## Features Overview

### Dashboard
- Real-time statistics and metrics
- Attendance trends visualization
- Low attendance alerts
- Quick access to recent activities

### Student Management
- Add/edit student profiles with photos
- Search and filter capabilities
- Department and year-wise organization
- Individual attendance tracking

### Subject Management
- Create and manage subjects
- Assign teachers to subjects
- Student enrollment management
- Subject-wise analytics

### Attendance System
- Create attendance sessions
- Manual attendance marking
- Bulk attendance operations
- Real-time attendance updates

### Analytics & Reports
- Comprehensive attendance reports
- Trend analysis and visualization
- Subject-wise performance metrics
- Exportable data formats

## Security Features

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Input validation and sanitization
- File upload restrictions
- CORS configuration

## Real-time Features

- Live attendance updates
- Real-time notifications
- Session-based updates
- Automatic data synchronization

## Future Enhancements

- Face recognition integration
- Mobile app development
- Advanced reporting features
- Integration with external systems
- Automated attendance via QR codes
- Email/SMS notifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please create an issue in the repository or contact the development team.