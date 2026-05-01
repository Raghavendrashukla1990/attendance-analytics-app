import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './ProfileView.css';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userData')) || {};
  } catch {
    return {};
  }
};

const getEmployeeId = () => {
  const user = getStoredUser();
  return (
    localStorage.getItem('employeeId') ||
    user.employeeid ||
    user.employeeId ||
    user.empid ||
    user.empId ||
    user.id
  );
};

const getAuthHeader = () => {
  const token = localStorage.getItem('authToken') || '';
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  return cleanToken ? `Bearer ${cleanToken}` : '';
};

const getDisplayValue = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  return value;
};

function ProfileView({ onViewAttendance }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const authorization = getAuthHeader();
      if (!authorization) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const employeeId = getEmployeeId();
      if (!employeeId) {
        setError('Employee ID was not found in your login session. Please logout and login again.');
        return;
      }

      const response = await fetch('https://api.sumhr.io:3000/api/employee/empaboutme', {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeid: Number(employeeId)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
      }

      setProfile(data?.result?.[0] || null);
    } catch (err) {
      setProfile(null);
      setError('Error fetching profile: ' + err.message);
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const initials = useMemo(() => {
    const name = profile?.fullname || `${profile?.firstname || ''} ${profile?.lastname || ''}`;
    const letters = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('');

    return letters || 'ME';
  }, [profile]);

  return (
    <div className="profile-container">
      <header className="profile-header">
        <button onClick={onViewAttendance} className="profile-attendance-btn">View Attendance</button>
        <h1>Employee Profile</h1>
        <button onClick={fetchProfile} className="profile-refresh-btn">Refresh</button>
      </header>

      <main className="profile-content">
        {loading && <div className="profile-state">Loading profile...</div>}

        {error && <div className="profile-error">{error}</div>}

        {!loading && !error && !profile && (
          <div className="profile-state">No profile information found.</div>
        )}

        {!loading && !error && profile && (
          <>
            <section className="profile-hero">
              <div className="profile-avatar">{initials.toUpperCase()}</div>
              <div className="profile-hero-copy">
                <div>
                  <p className="profile-kicker">About Me</p>
                  <h2>{getDisplayValue(profile.fullname || `${profile.firstname || ''} ${profile.lastname || ''}`.trim())}</h2>
                  <p>{getDisplayValue(profile.designationname)} · {getDisplayValue(profile.departmentname)}</p>
                </div>
                <button onClick={onViewAttendance} className="profile-hero-action">
                  Open Attendance
                </button>
              </div>
            </section>

            <section className="profile-grid">
              <div className="profile-card">
                <span>Employee Code</span>
                <strong>{getDisplayValue(profile.employeecode)}</strong>
              </div>
              <div className="profile-card">
                <span>Employee ID</span>
                <strong>{getDisplayValue(profile.employeeid)}</strong>
              </div>
              <div className="profile-card">
                <span>Business Unit</span>
                <strong>{getDisplayValue(profile.businessunitname)}</strong>
              </div>
              <div className="profile-card">
                <span>Email</span>
                <strong>{getDisplayValue(profile.email)}</strong>
              </div>
              <div className="profile-card">
                <span>Mobile</span>
                <strong>{profile.primarymobile ? `+${profile.callingcode || ''} ${profile.primarymobile}` : '-'}</strong>
              </div>
              <div className="profile-card">
                <span>Self Service</span>
                <strong>{profile.isselfservice ? 'Enabled' : 'Disabled'}</strong>
              </div>
            </section>

            <section className="profile-about-card">
              <div>
                <span>Preferred Name</span>
                <strong>{getDisplayValue(profile.preferredname)}</strong>
              </div>
              <div>
                <span>Team</span>
                <strong>{getDisplayValue(profile.teamname)}</strong>
              </div>
              <div>
                <span>About Yourself</span>
                <p>{getDisplayValue(profile.aboutyourself)}</p>
              </div>
              <div>
                <span>Hobbies</span>
                <p>{getDisplayValue(profile.hobbies)}</p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default ProfileView;
