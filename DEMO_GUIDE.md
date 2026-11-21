# TaskFlow Frontend Demo Guide

This is a frontend-only prototype. Authentication, accounts, admin approval, verification codes, and task persistence are simulated using browser storage. **Do not use real passwords or sensitive data.** No emails are sent and this is not secure authentication.

## Demo accounts

| Role | Email / username | Password | Initial state |
|---|---|---|---|
| User | `testuser1@mail.com` | `user1234` | Active |
| Admin | `testadmin1@mail.com` | `admin1234` | Pending approval |
| Master Admin | `masteradmin1@mail.com` | `ma1234` | Active |

## Approval walkthrough

1. Open `index.html` and choose Master Admin login.
2. Sign in using the Master Admin credentials.
3. In Admin Requests, approve Test Admin 1. A six-digit demo code is generated and shown in a browser alert. **No email is sent.**
4. Log out and open Admin login. Sign in as Test Admin 1. The approved but unverified account is sent to the verification page.
5. Enter the six-digit code shown during approval and submit. The account becomes active and the Admin Dashboard opens.
6. To test rejection instead, reset the demo, approve nothing, and reject the pending request. The admin login will show a rejection message.

## User task walkthrough

Sign in as Test User 1 to explore the User Dashboard, Task List, and Add Task. Initial tasks are seeded and can be edited, deleted, or updated. New tasks are saved locally under the current user's email.

## Reset

Use the **Reset Demo** button in the bottom-right corner of any page. Confirm to restore the original users, pending request, seeded tasks, and clear the active demo session.

## Browser storage used

- `taskflow_users` — demo accounts and status
- `taskflow_admin_requests` — admin requests
- `taskflow_tasks` — task records
- `taskflow_demo_otp` and `taskflow_demo_otp_email` — simulated verification code
- `taskflow_session` — active session in sessionStorage

## Backend integration notes

The demo is intentionally separate from backend APIs. The browser storage implementation is for UI demonstration only. Replace the demo authentication and storage layer with API calls when backend integration is ready; the task UI/store API is kept largely intact for prototype testing.


## QA hotfixes (v3)
- Admin dashboard profile dropdown styling added.
- Shared logout redirect now returns to `index.html` (previously pointed to missing `login.html`).
- Landing-page “Request administrator access” link now opens `admin-register.html`.
- Task List navigation/title is role-aware for administrators.
