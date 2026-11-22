# Campusly — College Event Management System

Campusly is a React + Vite frontend with an Express REST API and a MySQL database. Students can discover and register for campus events; administrators can create, update, and remove events and manage sign-ups. It uses bcrypt password hashes, JWT sessions, server-side validation, parameterized SQL, and database-enforced unique registrations.

## Project structure

```text
college-event-management/
├── backend/
│   ├── database/schema.sql       # Creates the database and three relational tables
│   ├── src/
│   │   ├── middleware/auth.js    # JWT authentication and role checks
│   │   ├── routes/auth.js        # Student registration and student/admin login
│   │   ├── routes/events.js      # Public event list/details, event CRUD, registrations
│   │   ├── routes/registrations.js # Student's events and admin registration management
│   │   ├── db.js                 # MySQL connection pool
│   │   ├── validation.js         # Shared input validation
│   │   ├── seedAdmin.js          # Creates the first administrator from environment settings
│   │   ├── seedEvents.js         # Adds optional demo events
│   │   └── server.js             # Express setup, security middleware, API startup
│   ├── .env.example              # Backend configuration template (copy to .env)
│   └── package.json              # Backend dependencies and commands
├── src/
│   ├── lib/api.js                # Frontend API client and auth header
│   ├── App.jsx                   # Pages, dialogs, event cards, and dashboard actions
│   ├── App.css                   # Responsive Campusly UI
│   ├── index.css                 # Global styles and design tokens
│   └── main.jsx                  # React entry point
├── index.html                    # Vite HTML entry
└── vite.config.js                # Proxies /api requests to Express in development
```

## MySQL database setup

1. Start MySQL Server.
2. Open `backend/database/schema.sql` in MySQL Workbench and execute it. It creates `college_event_management` and the `users`, `events`, and `registrations` tables, along with their keys and foreign-key relationships.
3. Copy the backend environment template and edit its values:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

4. In `backend/.env`, enter your MySQL password and choose a unique, random `JWT_SECRET` with at least 32 characters. Set a private administrator password of 12–72 characters in `ADMIN_PASSWORD`.
5. Install backend packages and create the administrator:

   ```powershell
   npm install
   npm run seed:admin
   npm run seed:events
   ```

`seed:events` is optional and inserts four upcoming demo events. It does not duplicate its sample events when run again. The seeded administrator email and password are the values configured in `backend/.env`; there are no hard-coded demo credentials.

## Install and run

Use two terminals from the project folder.

**Terminal 1 — backend:**

```powershell
cd backend
npm install
npm run dev
```

The API starts at `http://localhost:5000`. Check `http://localhost:5000/api/health` for `{"status":"ok"}`.

**Terminal 2 — frontend:**

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to the backend. The backend reads its configuration from `backend/.env`.

For a production-style API process, use `npm start` from `backend`. Build the frontend from the project root using `npm run build`.

## Test the app

1. Create a student account using a name, unique email, student ID, and password (at least 8 characters).
2. Sign in as a student, open an upcoming event, and select **Count me in**. It appears in **My events**.
3. Try registering for the same event again; the API rejects the duplicate. Registration also fails after the event reaches its configured capacity.
4. Sign out and choose **Administrator** on the login dialog. Use the credentials configured in `backend/.env`.
5. In **Manage events**, create an event, edit it, and delete it. In **Registrations**, review a student's sign-up and remove it.
6. To test capacity, create an event with capacity `1`, register one student, then try the same event with another student.
7. Check API health at `http://localhost:5000/api/health`; API errors are returned as readable JSON messages in the UI.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a student account |
| POST | `/api/auth/login` | Public | Sign in as a student or seeded admin |
| GET | `/api/events` | Public / admin | List upcoming events (admins can also see past events) |
| GET | `/api/events/:id` | Public | Fetch event details |
| POST | `/api/events/:id/register` | Student | Register once, if capacity remains |
| POST | `/api/events` | Admin | Create an event |
| PUT | `/api/events/:id` | Admin | Update an event |
| DELETE | `/api/events/:id` | Admin | Delete an event and its registrations |
| GET | `/api/registrations/mine` | Student | List the signed-in student's registrations |
| GET | `/api/admin/registrations` | Admin | View all event registrations |
| DELETE | `/api/admin/registrations/:id` | Admin | Remove a registration |

## Modules — viva notes (simple Hinglish)

- **Frontend (`src/App.jsx`)**: React components se discovery page, event cards, login/signup dialogs, student ka My Events view aur admin ke management screens bante hain. Forms API ko call karte hain aur success/error messages dikhate hain.
- **API client (`src/lib/api.js`)**: Frontend requests ko `/api` par bhejta hai, JWT bearer token attach karta hai, aur API ki readable error message UI tak laata hai.
- **Authentication (`backend/src/routes/auth.js`)**: Student signup ke waqt password bcrypt se hash hota hai. Login par hash compare karke short-lived JWT milta hai. Admin signup public nahi hai; pehla admin seed command se banta hai.
- **Authorization (`backend/src/middleware/auth.js`)**: JWT verify karke user identity set karta hai. Role middleware ensure karta hai ki event management aur all-registrations endpoints sirf admin chala sake.
- **Events (`backend/src/routes/events.js`)**: Public event listing/detail aur admin ka create/update/delete yahan hai. Event data validate hota hai aur SQL values parameterized hain. Registration ke waqt event row lock, duplicate check, aur capacity check ek transaction mein hote hain.
- **Registrations (`backend/src/routes/registrations.js`)**: Student ko sirf apni registrations milti hain; admin sab students aur events ki registration dekh/removal kar sakta hai.
- **Database (`backend/database/schema.sql`)**: `users`, `events`, `registrations` InnoDB tables hain. Foreign keys orphan rows rokte hain; `(user_id, event_id)` unique key duplicate registration ko database level par rokta hai.
- **Configuration (`backend/.env`)**: DB connection, allowed frontend origin, JWT signing key, aur initial admin credentials environment mein rehte hain—source code mein secrets nahi.
- **Development proxy (`vite.config.js`)**: Browser ki `/api` request backend ke localhost port 5000 par forward karta hai, taaki dev mein frontend aur API ke beech CORS setup ki zaroorat na pade.

Yeh project mini-project/demo ke liye hai. Public deployment se pehle HTTPS, secure cookie-based session storage, email verification, backups, aur production secrets management configure karein.
