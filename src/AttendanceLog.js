import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './AttendanceLog.css';

const DAILY_REQUIRED_HOURS = 10;
const MONTHLY_START_DEDUCTION_HOURS = 5;
const HALF_DAY_DEDUCTION_HOURS = 5;

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

const getField = (record, fields, fallback = '') => {
  const normalizedRecord = Object.keys(record || {}).reduce((acc, key) => {
    acc[key.toLowerCase()] = record[key];
    return acc;
  }, {});

  for (const field of fields) {
    const value = normalizedRecord[field.toLowerCase()];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
};

const normalizeAttendanceRecords = (payload) => {
  const commonArrayKeys = [
    'employeeattendancelog',
    'employeeAttendanceLog',
    'employeeAttendanceLogs',
    'attendancelog',
    'attendanceLog',
    'attendanceLogs',
    'attendance',
    'records',
    'rows',
    'list',
    'data'
  ];

  const readFrom = (value) => {
    if (Array.isArray(value)) {
      const nestedRecords = value.flatMap((item) => readFrom(item));
      if (nestedRecords.length > 0) {
        return nestedRecords;
      }

      return value;
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    for (const key of commonArrayKeys) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }

    for (const key of commonArrayKeys) {
      const nested = readFrom(value[key]);
      if (nested.length > 0) {
        return nested;
      }
    }

    return value.date || value.attendancedate || value.attendanceDate || value.shiftdate ? [value] : [];
  };

  return readFrom(payload?.result || payload?.data || payload);
};

const getRecordValues = (record) => {
  const workDuration = getField(record, [
    'workduration',
    'workDuration',
    'duration',
    'workinghours',
    'workingHours',
    'workhours',
    'workHours'
  ], '');

  return {
    date: getField(record, ['date', 'attendancedate', 'attendanceDate', 'shiftdate', 'shiftDate']),
    checkIn: getField(record, ['checkin', 'checkIn', 'intime', 'inTime', 'punchin', 'punchIn'], '-'),
    checkOut: getField(record, ['checkout', 'checkOut', 'outtime', 'outTime', 'punchout', 'punchOut'], '-'),
    workDuration,
    breakDuration: getField(record, ['breakduration', 'breakDuration', 'break', 'breakTime'], '-'),
    lateBy: getField(record, ['lateby', 'lateBy'], '-'),
    status: getField(record, ['status', 'attendancestatus', 'attendanceStatus', 'statusstring', 'statusString'], 'Unknown'),
    duration: workDuration
  };
};

const parseTimeToMinutes = (timeString) => {
  if (!timeString || timeString === '-') return null;

  const [hours, minutes, seconds = '0'] = String(timeString).split(':');
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  const parsedSeconds = Number(seconds);

  if ([parsedHours, parsedMinutes, parsedSeconds].some(Number.isNaN)) {
    return null;
  }

  return (parsedHours * 60) + parsedMinutes + (parsedSeconds / 60);
};

const parseDurationToHours = (duration) => {
  if (!duration || duration === '-') return 0;

  if (typeof duration === 'number') {
    return duration;
  }

  const value = String(duration).trim();
  const colonParts = value.split(':');

  if (colonParts.length >= 2) {
    const hours = Number(colonParts[0]);
    const minutes = Number(colonParts[1]);
    const seconds = Number(colonParts[2] || 0);

    if ([hours, minutes, seconds].every((part) => !Number.isNaN(part))) {
      return hours + (minutes / 60) + (seconds / 3600);
    }
  }

  const decimalHours = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isNaN(decimalHours) ? 0 : decimalHours;
};

const getWorkedHours = ({ checkIn, checkOut, duration }) => {
  const durationHours = parseDurationToHours(duration);
  if (durationHours > 0) {
    return durationHours;
  }

  const inMinutes = parseTimeToMinutes(checkIn);
  const outMinutes = parseTimeToMinutes(checkOut);

  if (inMinutes === null || outMinutes === null) {
    return 0;
  }

  const adjustedOutMinutes = outMinutes < inMinutes ? outMinutes + (24 * 60) : outMinutes;
  return Math.max((adjustedOutMinutes - inMinutes) / 60, 0);
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateKey = (dateString) => {
  if (!dateString) return '';
  return String(dateString).slice(0, 10);
};

const getCurrentMonthKey = () => getLocalDateKey().slice(0, 7);

const getCurrentMonthBounds = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: getLocalDateKey(start),
    end: getLocalDateKey(end)
  };
};

const sortDates = (dates) => [...dates].sort((first, second) => first.localeCompare(second));

const formatHours = (hours) => {
  const totalMinutes = Math.round((hours || 0) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
};

const isWeekend = (dateString) => {
  if (!dateString) return false;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;

  const day = date.getDay();
  return day === 0 || day === 6;
};

function AttendanceLog({ onBack }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [halfDayDates, setHalfDayDates] = useState([]);
  const [selectedHalfDayDate, setSelectedHalfDayDate] = useState(getLocalDateKey());

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const currentMonthBounds = useMemo(() => getCurrentMonthBounds(), []);
  const halfDayStorageKey = useMemo(() => {
    return `attendanceHalfDays:${getEmployeeId() || 'current'}:${currentMonthKey}`;
  }, [currentMonthKey]);

  const fetchAttendanceData = useCallback(async () => {
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
        setAttendanceData([]);
        setError('Employee ID was not found in your login session. Please logout and login again.');
        return;
      }

      // Get current month dates
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
      const fromDate = `${currentYear}-${currentMonth}-01`;
      const toDate = `${currentYear}-${currentMonth}-${String(today.getDate()).padStart(2, '0')}`;

      const response = await fetch('https://api.sumhr.io:3000/api/attendance/getattendancelog', {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeid: Number(employeeId),
          fromdate: fromDate,
          todate: toDate,
          accesstypeid: 2
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
      }

      setAttendanceData(normalizeAttendanceRecords(data));
    } catch (err) {
      setAttendanceData([]);
      setError('Error fetching attendance data: ' + err.message);
      console.error('Attendance fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  useEffect(() => {
    try {
      const storedHalfDays = JSON.parse(localStorage.getItem(halfDayStorageKey)) || [];
      const validHalfDays = storedHalfDays.filter((date) => String(date).startsWith(currentMonthKey));
      setHalfDayDates(sortDates(validHalfDays));
    } catch {
      setHalfDayDates([]);
    }
  }, [currentMonthKey, halfDayStorageKey]);

  useEffect(() => {
    localStorage.setItem(halfDayStorageKey, JSON.stringify(sortDates(halfDayDates)));
  }, [halfDayDates, halfDayStorageKey]);

  const attendanceRows = useMemo(() => {
    const halfDayDateSet = new Set(halfDayDates);

    return attendanceData.map((record, index) => {
      const values = getRecordValues(record);
      const workedHours = getWorkedHours(values);
      const weeklyOff = isWeekend(values.date);
      const requiredHours = weeklyOff ? 0 : DAILY_REQUIRED_HOURS;
      const dateKey = getDateKey(values.date);

      return {
        ...values,
        id: record.id || record.attendanceid || record.attendancelogid || index,
        dateKey,
        requiredHours,
        workedHours,
        weeklyOff,
        isHalfDay: halfDayDateSet.has(dateKey),
        balanceHours: workedHours - requiredHours,
        statusClass: String(values.status).toLowerCase().replace(/\s+/g, '-')
      };
    });
  }, [attendanceData, halfDayDates]);

  const monthlySummary = useMemo(() => {
    const totalWorkedHours = attendanceRows.reduce((sum, row) => sum + row.workedHours, 0);
    const workingAttendanceDays = attendanceRows.filter((row) => !row.weeklyOff).length;
    const totalWorkHours = workingAttendanceDays * DAILY_REQUIRED_HOURS;
    const halfDayDeductedHours = halfDayDates.length * HALF_DAY_DEDUCTION_HOURS;
    const totalDeductedHours = MONTHLY_START_DEDUCTION_HOURS + halfDayDeductedHours;
    const remainingWorkHours = totalWorkHours - totalDeductedHours;

    return {
      workingAttendanceDays,
      totalWorkedHours,
      totalWorkHours,
      halfDayDeductedHours,
      totalDeductedHours,
      remainingWorkHours,
      balanceHours: totalWorkedHours - totalWorkHours
    };
  }, [attendanceRows, halfDayDates]);

  const toggleHalfDay = (dateString) => {
    const dateKey = getDateKey(dateString);
    if (!dateKey || !dateKey.startsWith(currentMonthKey)) return;

    setHalfDayDates((currentDates) => {
      const nextDates = new Set(currentDates);
      if (nextDates.has(dateKey)) {
        nextDates.delete(dateKey);
      } else {
        nextDates.add(dateKey);
      }

      return sortDates(nextDates);
    });
  };

  const addSelectedHalfDay = () => {
    toggleHalfDay(selectedHalfDayDate);
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return '-';
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString) => {
    try {
      if (!timeString) return '-';
      // Assuming time format like "HH:MM:SS"
      return timeString.substring(0, 5);
    } catch {
      return timeString;
    }
  };

  const formatDuration = (duration) => {
    if (!duration || duration === '-') return '-';
    return formatHours(parseDurationToHours(duration));
  };

  return (
    <div className="attendance-container">
      <header className="attendance-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h1>Attendance Log - Current Month</h1>
        <button onClick={fetchAttendanceData} className="refresh-btn">Refresh</button>
      </header>

      <main className="attendance-content">
        {loading && <div className="loading-spinner">Loading attendance data...</div>}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && attendanceData.length === 0 && (
          <div className="no-data">No attendance records found for this month.</div>
        )}

        {!loading && !error && attendanceData.length > 0 && (
          <>
            <div className="table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Attendance Date</th>
                    <th>Half Day</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Work Duration</th>
                    <th>Break Duration</th>
                    <th>Late By</th>
                    <th>Status</th>
                    <th>Total Worked Hours</th>
                    <th>Total Work Hours</th>
                    <th>Day Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((row) => (
                    <tr key={row.id} className={`status-${row.statusClass}`}>
                      <td>{formatDate(row.date)}</td>
                      <td>
                        <label className="half-day-toggle">
                          <input
                            type="checkbox"
                            checked={row.isHalfDay}
                            onChange={() => toggleHalfDay(row.dateKey)}
                          />
                          <span>{row.isHalfDay ? 'Marked' : 'No'}</span>
                        </label>
                      </td>
                      <td>{formatTime(row.checkIn)}</td>
                      <td>{formatTime(row.checkOut)}</td>
                      <td>{formatDuration(row.workDuration)}</td>
                      <td>{formatDuration(row.breakDuration)}</td>
                      <td>{formatDuration(row.lateBy)}</td>
                      <td>
                        <span className={`badge badge-${row.statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{formatHours(row.workedHours)}</td>
                      <td>{row.weeklyOff ? 'Weekly off' : formatHours(row.requiredHours)}</td>
                      <td className={row.balanceHours >= 0 ? 'hours-positive' : 'hours-negative'}>
                        {row.balanceHours >= 0 ? '+' : '-'}{formatHours(Math.abs(row.balanceHours))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default AttendanceLog;
