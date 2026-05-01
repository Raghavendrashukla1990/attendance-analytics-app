import React, { useState } from 'react';
import './App.css';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import AttendanceLog from './AttendanceLog';
import ProfileView from './ProfileView';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('profile');

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentPage('profile');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('employeeId');
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
  };

  const handleViewAttendance = () => {
    setCurrentPage('attendance');
  };

  const handleViewProfile = () => {
    setCurrentPage('profile');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  return (
    <div className="App">
      {isAuthenticated ? (
        currentPage === 'attendance' ? (
          <AttendanceLog onBack={handleBackToDashboard} onViewProfile={handleViewProfile} />
        ) : currentPage === 'profile' ? (
          <ProfileView onViewAttendance={handleViewAttendance} />
        ) : (
          <Dashboard onLogout={handleLogout} onViewAttendance={handleViewAttendance} onViewProfile={handleViewProfile} />
        )
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
