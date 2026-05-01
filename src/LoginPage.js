import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://api.sumhr.io:3000/api/subscription/passwordlogin', {
        method: 'POST',
        headers: {
          'Authorization': 'Global eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdW1IUiIsIm5hbWUiOiJzdW1IUi1KV1QiLCJqdGkiOiI1MTRhNTRiMi0xY2M1LTRkYzYtYWVmNC1lNmFhZmQ2MDEwOGIiLCJpYXQiOjE1MzcxNzI4MTMsImV4cCI6MTUzNzE3NjQxM30.kN0pHK0B-PchPACYdWHvN1U2XQgVN0bs3__7zRwc6h4',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          password: password,
          subscriptionid: 1114,
          browserdetail: 'chrome',
          logintype: 1
        })
      });

      const data = await response.json();

      if (data.result && data.result.length > 0 && data.result[0].token) {
        const user = data.result[0];
        const token = user.token.replace(/^Bearer\s+/i, '').trim();
        const employeeId = user.employeeid || user.employeeId || user.empid || user.empId || user.id;

        // Save token to localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(user));

        if (employeeId) {
          localStorage.setItem('employeeId', String(employeeId));
        }

        onLoginSuccess();
      } else {
        setError('Login failed. Invalid credentials or no token received.');
      }
    } catch (err) {
      setError('Error logging in: ' + err.message);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Attendance Panel</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
