import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import LoginPage from './LoginPage';
import AttendanceLog from './AttendanceLog';
import ProfileView from './ProfileView';
import { clearSession, getTokenExpiryMs, isSessionValid } from './auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => isSessionValid());
  const [currentPage, setCurrentPage] = useState('profile');

  const handleLogout = useCallback(() => {
    clearSession();
    setIsAuthenticated(false);
    setCurrentPage('profile');
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const expiry = getTokenExpiryMs();
    const msUntilExpiry = expiry - Date.now();

    if (msUntilExpiry <= 0) {
      handleLogout();
      return undefined;
    }

    const timeoutId = setTimeout(handleLogout, msUntilExpiry);

    const onStorage = (event) => {
      if (event.key === 'authToken' && !isSessionValid()) {
        handleLogout();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('storage', onStorage);
    };
  }, [isAuthenticated, handleLogout]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentPage('profile');
  };

  const handleViewAttendance = () => setCurrentPage('attendance');
  const handleViewProfile = () => setCurrentPage('profile');

  if (!isAuthenticated) {
    return (
      <div className="App">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="App">
      {currentPage === 'attendance' ? (
        <AttendanceLog
          onBack={handleViewProfile}
          onLogout={handleLogout}
        />
      ) : (
        <ProfileView
          onViewAttendance={handleViewAttendance}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
