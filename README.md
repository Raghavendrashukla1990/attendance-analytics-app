# Attendance Panel

A small React single-page app that signs an employee in to **sumHR** and shows their profile and monthly attendance log with a custom hours-deduction summary.

## Features

- **JWT-based session** — login persists across page reloads until the token's `exp` claim passes; an in-app timer auto-logs-out the user the moment it expires, and a `storage` listener keeps multiple tabs in sync.
- **Profile view** — fetched from `/api/employee/empaboutme`: avatar with initials, designation/department, employee code/ID, business unit, contact details, preferred name, team, "About Yourself" and "Hobbies".
- **Attendance log** — fetched from `/api/attendance/getattendancelog` for the selected month (date range capped at today for the current month).
- **Month picker** — review previous months' data; half-day / full-day leave marks are stored separately per month so each month keeps its own state.
- **Per-day leave marks** — two mutually-exclusive checkboxes on every row:
  - **Half Day Leave** → 5 h deduction
  - **Full Day Leave** → 10 h deduction
- **Monthly summary cards**
  - **Total Worked Hours** = sum of every row's `Total Worked Hours`
  - **Total Working Hours** = `Present Days × 10`
  - **Remaining Work** = `Total Worked Hours − (5 h auto + half-days × 5 h + full-days × 10 h)` (signed value, can go negative)
- **Persistent leave marks** — half-day and full-day selections are saved to `localStorage` per `employeeId × month` so a refresh doesn't lose them. A "Clear N leave marks" button on the summary card resets them for the selected month.

## Tech stack

- React 19 + Create React App (`react-scripts` 5)
- Plain `fetch` against the sumHR REST API — no extra HTTP/auth libraries
- `localStorage` for session token and per-month leave marks

## Project layout

```
src/
├── App.js              Top-level router (login / profile / attendance) + session lifecycle
├── auth.js             JWT helpers: getStoredToken, getTokenExpiryMs, isSessionValid, clearSession, getAuthHeader, getEmployeeId
├── LoginPage.{js,css}  Username/password form, calls /api/subscription/passwordlogin
├── ProfileView.{js,css}  About-me page, calls /api/employee/empaboutme
├── AttendanceLog.{js,css}  Month picker, summary cards, per-day table with leave checkboxes
├── App.css / index.{css,js}
└── reportWebVitals.js / setupTests.js
public/
└── index.html, manifest.json, icons
.nvmrc                  Pins Node 20 for this project
```

## Prerequisites

- **Node ≥ 18** (Node 20 recommended). Older Node releases (e.g. 10) cannot parse the modern syntax used by `react-scripts 5` / `jest-worker` and will crash at startup.
- A valid sumHR account on subscription `1114` to actually sign in. The pre-shared `Global` token in [`LoginPage.js`](src/LoginPage.js) is what sumHR expects on the login endpoint.

## Getting started

```bash
git clone <your-fork-url>
cd attendance-analytics-app

# Use the Node version pinned in .nvmrc (20)
nvm use            # if you use nvm. Otherwise install Node 20 manually.

npm install
npm start
```

The dev server runs at **http://localhost:3000** with hot reload. Use a different port via `PORT=3001 npm start`.

If your shell defaults to an older Node version, make Node 20 the default once:

```bash
nvm alias default 20.11.0
```

## Available scripts

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `npm start`      | Dev server with hot reload at http://localhost:3000                 |
| `npm run build`  | Optimized production bundle in `build/`                             |
| `npm test`       | Runs Jest in watch mode                                             |
| `npm run eject`  | One-way CRA eject. Don't run unless you really need to              |

## App flow

```
LoginPage  ──login──►  ProfileView  ──"View Attendance"──►  AttendanceLog
   ▲                       │                                     │
   │                       └──────────"Logout"──────────────────►│
   │                                                              │
   └─── token expiry / explicit Logout clears localStorage ◄──────┘
```

- On any successful `App` mount, `isSessionValid()` decodes the stored JWT and rehydrates the session if still valid.
- A `setTimeout` armed for the exact `exp` instant fires `handleLogout()` automatically.
- The Attendance back arrow returns the user to Profile (not a separate dashboard).

## Calculation reference

| Term                     | Formula                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| Daily required hours     | `10`                                                                             |
| Monthly auto deduction   | `5 h`                                                                            |
| Half-day leave           | `5 h` deduction (`HALF_DAY_LEAVE_HOURS`)                                         |
| Full-day leave           | `10 h` deduction (`FULL_DAY_LEAVE_HOURS`)                                        |
| Present Days             | rows where API status matches `/present/i`                                       |
| Absent Days              | rows where API status matches `/absent/i` (shown as info; doesn't double-deduct) |
| **Total Worked Hours**   | `Σ workedHours` from every row                                                   |
| **Total Working Hours**  | `Present Days × 10`                                                              |
| **Remaining Work**       | `Total Worked Hours − (5 h + half × 5 h + full × 10 h)` — signed                 |

`workedHours` per row prefers the API's `workDuration`; if absent it falls back to `checkOut − checkIn`.

## API endpoints used

All requests go to `https://api.sumhr.io:3000`:

| Purpose       | Method | Path                                  | Auth                       |
| ------------- | ------ | ------------------------------------- | -------------------------- |
| Login         | POST   | `/api/subscription/passwordlogin`     | `Global <pre-shared JWT>`  |
| Profile       | POST   | `/api/employee/empaboutme`            | `Bearer <user JWT>`        |
| Attendance    | POST   | `/api/attendance/getattendancelog`    | `Bearer <user JWT>`        |

Login body: `{ username, password, subscriptionid: 1114, browserdetail: "chrome", logintype: 1 }`.
The response's `result[0].token` is stripped of any `Bearer ` prefix and saved as `authToken`; the user object is saved as `userData`; the employee id is saved as `employeeId`.

## Local storage keys

| Key                                              | Holds                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| `authToken`                                      | Raw JWT (no `Bearer ` prefix)                          |
| `userData`                                       | JSON of the login response's `result[0]` user object   |
| `employeeId`                                     | Numeric employee id (string-encoded)                   |
| `attendanceHalfDays:<empId>:<YYYY-MM>`           | JSON array of `YYYY-MM-DD` strings marked as half-day  |
| `attendanceFullDays:<empId>:<YYYY-MM>`           | JSON array of `YYYY-MM-DD` strings marked as full-day  |

Logging out clears the first three. Leave marks are kept so prior months don't lose their state, and can be wiped via the in-app "Clear N leave marks" button.

## Troubleshooting

- **`Unexpected token ;` on `npm start`** — you're on Node 10 (or similar). Run `nvm use` (or install Node 20).
- **Login succeeds but no data appears** — open DevTools → Application → Local Storage and verify `authToken`, `userData`, and `employeeId` are present. If `employeeId` is missing the API call rejects with a clear in-app message.
- **`Total Working Hours` looks low** — check the subtitle on the card. It shows the live `present × 10h (N absent excluded)` breakdown.
- **`Remaining Work` looks off** — click the "Clear N leave marks" button on the Total Working Hours card to reset stale half-day / full-day marks for the selected month, then re-mark intentionally.
- **Stale UI after deploy** — hard-refresh with **Ctrl + Shift + R**.
