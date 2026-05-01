const decodeJwtPayload = (token) => {
  try {
    const segment = String(token).split('.')[1];
    if (!segment) return null;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded + '==='.slice((padded.length + 3) % 4));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const getStoredToken = () => {
  const raw = localStorage.getItem('authToken') || '';
  return raw.replace(/^Bearer\s+/i, '').trim();
};

export const getTokenExpiryMs = (token = getStoredToken()) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return 0;
  return Number(payload.exp) * 1000;
};

export const isSessionValid = () => {
  const token = getStoredToken();
  if (!token) return false;
  const expiry = getTokenExpiryMs(token);
  if (!expiry) return false;
  return expiry > Date.now();
};

export const clearSession = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('employeeId');
};

export const getAuthHeader = () => {
  const token = getStoredToken();
  return token ? `Bearer ${token}` : '';
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userData')) || {};
  } catch {
    return {};
  }
};

export const getEmployeeId = () => {
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
