import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './AttendanceLog.css';
import { getAuthHeader, getEmployeeId } from './auth';

const DAILY_REQUIRED_HOURS = 10;
const MONTHLY_AUTO_DEDUCTION_HOURS = 5;
const HALF_DAY_LEAVE_HOURS = 5;
const FULL_DAY_LEAVE_HOURS = 10;

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

const parseMonthKey = (monthKey) => {
  const [yearStr, monthStr] = String(monthKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
};

const getMonthBounds = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const { year, month } = parsed;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    year,
    month,
    daysInMonth: end.getDate(),
    start: getLocalDateKey(start),
    end: getLocalDateKey(end)
  };
};

const countWeekdaysInMonth = (monthKey) => {
  const bounds = getMonthBounds(monthKey);
  if (!bounds) return 0;
  let weekdays = 0;
  for (let day = 1; day <= bounds.daysInMonth; day += 1) {
    const dow = new Date(bounds.year, bounds.month, day).getDay();
    if (dow !== 0 && dow !== 6) weekdays += 1;
  }
  return weekdays;
};


function AttendanceLog({ onBack, onLogout }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [halfDayDates, setHalfDayDates] = useState([]);
  const [fullDayDates, setFullDayDates] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey());

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const halfDayStorageKey = useMemo(() => {
    return `attendanceHalfDays:${getEmployeeId() || 'current'}:${selectedMonth}`;
  }, [selectedMonth]);
  const fullDayStorageKey = useMemo(() => {
    return `attendanceFullDays:${getEmployeeId() || 'current'}:${selectedMonth}`;
  }, [selectedMonth]);

  const monthBounds = useMemo(() => getMonthBounds(selectedMonth), [selectedMonth]);
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const monthLabel = useMemo(() => {
    if (!monthBounds) return selectedMonth;
    return new Date(monthBounds.year, monthBounds.month, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [monthBounds, selectedMonth]);

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

      if (!monthBounds) {
        setAttendanceData([]);
        setError('Invalid month selected.');
        return;
      }

      const fromDate = monthBounds.start;
      const todayKey = getLocalDateKey();
      const toDate = isCurrentMonth && todayKey < monthBounds.end ? todayKey : monthBounds.end;

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
  }, [monthBounds, isCurrentMonth]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  useEffect(() => {
    try {
      const storedHalfDays = JSON.parse(localStorage.getItem(halfDayStorageKey)) || [];
      const validHalfDays = storedHalfDays.filter((date) => String(date).startsWith(selectedMonth));
      setHalfDayDates(sortDates(validHalfDays));
    } catch {
      setHalfDayDates([]);
    }

    try {
      const storedFullDays = JSON.parse(localStorage.getItem(fullDayStorageKey)) || [];
      const validFullDays = storedFullDays.filter((date) => String(date).startsWith(selectedMonth));
      setFullDayDates(sortDates(validFullDays));
    } catch {
      setFullDayDates([]);
    }
  }, [selectedMonth, halfDayStorageKey, fullDayStorageKey]);

  useEffect(() => {
    localStorage.setItem(halfDayStorageKey, JSON.stringify(sortDates(halfDayDates)));
  }, [halfDayDates, halfDayStorageKey]);

  useEffect(() => {
    localStorage.setItem(fullDayStorageKey, JSON.stringify(sortDates(fullDayDates)));
  }, [fullDayDates, fullDayStorageKey]);

  const attendanceRows = useMemo(() => {
    const halfDayDateSet = new Set(halfDayDates);
    const fullDayDateSet = new Set(fullDayDates);

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
        isFullDayLeave: fullDayDateSet.has(dateKey),
        balanceHours: workedHours - requiredHours,
        statusClass: String(values.status).toLowerCase().replace(/\s+/g, '-')
      };
    });
  }, [attendanceData, halfDayDates, fullDayDates]);

  const monthlySummary = useMemo(() => {
    const totalWorkedHours = attendanceRows.reduce((sum, row) => sum + row.workedHours, 0);
    const presentDays = attendanceRows.filter((row) => /present/i.test(String(row.status))).length;
    const absentDays = attendanceRows.filter((row) => /absent/i.test(String(row.status))).length;
    const workingDays = countWeekdaysInMonth(selectedMonth);
    const totalWorkHours = workingDays * DAILY_REQUIRED_HOURS;
    const halfDayDeductedHours = halfDayDates.length * HALF_DAY_LEAVE_HOURS;
    const fullDayDeductedHours = fullDayDates.length * FULL_DAY_LEAVE_HOURS;
    const remainingWorkHours = (totalWorkedHours + MONTHLY_AUTO_DEDUCTION_HOURS + halfDayDeductedHours) - totalWorkHours;
    const currentAvgWorkHours = presentDays > 0 ? totalWorkedHours / presentDays : 0;
    const avgTargetWorkHours = workingDays > 0
      ? (totalWorkHours - MONTHLY_AUTO_DEDUCTION_HOURS) / workingDays
      : 0;

    return {
      presentDays,
      absentDays,
      workingDays,
      totalWorkedHours,
      totalWorkHours,
      halfDayDeductedHours,
      fullDayDeductedHours,
      remainingWorkHours,
      currentAvgWorkHours,
      avgTargetWorkHours
    };
  }, [attendanceRows, halfDayDates, fullDayDates, selectedMonth]);

  const toggleHalfDay = (dateString) => {
    const dateKey = getDateKey(dateString);
    if (!dateKey || !dateKey.startsWith(selectedMonth)) return;

    setFullDayDates((currentDates) =>
      currentDates.includes(dateKey) ? currentDates.filter((d) => d !== dateKey) : currentDates
    );

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

  const toggleFullDayLeave = (dateString) => {
    const dateKey = getDateKey(dateString);
    if (!dateKey || !dateKey.startsWith(selectedMonth)) return;

    setHalfDayDates((currentDates) =>
      currentDates.includes(dateKey) ? currentDates.filter((d) => d !== dateKey) : currentDates
    );

    setFullDayDates((currentDates) => {
      const nextDates = new Set(currentDates);
      if (nextDates.has(dateKey)) {
        nextDates.delete(dateKey);
      } else {
        nextDates.add(dateKey);
      }

      return sortDates(nextDates);
    });
  };

  const clearAllLeaveMarks = () => {
    setHalfDayDates([]);
    setFullDayDates([]);
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
        <button onClick={onBack} className="back-btn" type="button">← Profile</button>
        <h1>Attendance Log - {monthLabel}</h1>
        <div className="attendance-header-actions">
          <label className="month-picker">
            <span>Month</span>
            <input
              type="month"
              value={selectedMonth}
              max={currentMonthKey}
              onChange={(event) => setSelectedMonth(event.target.value || currentMonthKey)}
            />
          </label>
          <button onClick={fetchAttendanceData} className="refresh-btn" type="button">Refresh</button>
          <button onClick={onLogout} className="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main className="attendance-content">
        {loading && <div className="loading-spinner">Loading attendance data...</div>}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && attendanceData.length === 0 && (
          <div className="no-data">No attendance records found for {monthLabel}.</div>
        )}

        {!loading && !error && attendanceData.length > 0 && (
          <>
            <section className="summary-grid">
              <div className="summary-card">
                <span>Total Worked Hours</span>
                <strong>{formatHours(monthlySummary.totalWorkedHours)}</strong>
                <small>sum of daily Total Worked Hours</small>
              </div>
              <div className="summary-card">
                <span>Total Working Hours</span>
                <strong>{formatHours(monthlySummary.totalWorkHours)}</strong>
                <small>{monthlySummary.workingDays} weekdays × {DAILY_REQUIRED_HOURS}h (Sat & Sun excluded)</small>
                {(halfDayDates.length > 0 || fullDayDates.length > 0) && (
                  <button
                    type="button"
                    className="clear-marks-btn"
                    onClick={clearAllLeaveMarks}
                    title={`Half-day: ${halfDayDates.join(', ') || 'none'}\nFull-day: ${fullDayDates.join(', ') || 'none'}`}
                  >
                    Clear {halfDayDates.length + fullDayDates.length} leave mark{halfDayDates.length + fullDayDates.length === 1 ? '' : 's'}
                  </button>
                )}
              </div>
              <div className={`summary-card ${monthlySummary.remainingWorkHours >= 0 ? 'positive' : 'negative'}`}>
                <span>Remaining Work</span>
                <strong>
                  {monthlySummary.remainingWorkHours >= 0 ? '+' : '−'}{formatHours(Math.abs(monthlySummary.remainingWorkHours))}
                </strong>
              </div>
              <div className="summary-card">
                <span>Current Avg Timing</span>
                <strong>{formatHours(monthlySummary.currentAvgWorkHours)}</strong>
                <small>Total Worked Hours ÷ {monthlySummary.presentDays} present day{monthlySummary.presentDays === 1 ? '' : 's'}</small>
              </div>
              <div className="summary-card">
                <span>Avg Timing</span>
                <strong>{formatHours(monthlySummary.avgTargetWorkHours)}</strong>
                <small>(Total Working Hours − {MONTHLY_AUTO_DEDUCTION_HOURS}h auto) ÷ {monthlySummary.workingDays} weekday{monthlySummary.workingDays === 1 ? '' : 's'}</small>
              </div>
            </section>

            <div className="table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Attendance Date</th>
                    <th>Half Day Leave</th>
                    <th>Full Day Leave</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Work Duration</th>
                    <th>Break Duration</th>
                    <th>Late By</th>
                    <th>Status</th>
                    <th>Total Worked Hours</th>
                    <th>Total Work Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((row) => {
                    const rowClasses = [
                      `status-${row.statusClass}`,
                      row.isHalfDay ? 'marked-half-day' : '',
                      row.isFullDayLeave ? 'marked-full-day-leave' : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <tr key={row.id} className={rowClasses}>
                        <td>{formatDate(row.date)}</td>
                        <td>
                          <label className="half-day-toggle">
                            <input
                              type="checkbox"
                              checked={row.isHalfDay}
                              onChange={() => toggleHalfDay(row.dateKey)}
                            />
                            <span>{row.isHalfDay ? `−${HALF_DAY_LEAVE_HOURS}h` : 'No'}</span>
                          </label>
                        </td>
                        <td>
                          <label className="leave-day-toggle">
                            <input
                              type="checkbox"
                              checked={row.isFullDayLeave}
                              onChange={() => toggleFullDayLeave(row.dateKey)}
                            />
                            <span>{row.isFullDayLeave ? `−${FULL_DAY_LEAVE_HOURS}h` : 'No'}</span>
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
                      </tr>
                    );
                  })}
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
