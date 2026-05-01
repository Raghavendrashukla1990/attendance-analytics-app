import React from 'react';
import './Dashboard.css';

function Dashboard({ onLogout, onViewAttendance, onViewProfile }) {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="header-kicker">Workforce Console</p>
          <h1>Attendance Panel</h1>
        </div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>
      
      <main className="dashboard-content">
        <div className="welcome-panel">
          <div>
            <p className="eyebrow">Signed in</p>
            <h2>Good to see you.</h2>
            <p>Open your current month attendance log and review check-ins, check-outs, status, and work duration.</p>
          </div>
          <div className="welcome-actions">
            <button onClick={onViewAttendance} className="primary-action">View Attendance</button>
            <button onClick={onViewProfile} className="secondary-action">View Profile</button>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="metric-card">
            <span className="metric-label">Period</span>
            <strong>Current Month</strong>
          </section>
          <section className="metric-card">
            <span className="metric-label">Data Source</span>
            <strong>sumHR API</strong>
          </section>
          <section className="metric-card">
            <span className="metric-label">Session</span>
            <strong>Active</strong>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
