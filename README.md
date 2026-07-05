# Green Generation — ESG Project Management Platform

A modern web platform for tracking, reporting, and managing ESG (Environmental, Social, Governance) metrics across events and projects. Built on a React + Vite frontend, an Express backend, and Supabase (Postgres) database.

---

## Prerequisites

Ensure you have the following installed before setting up the project:
* **Node.js** (v18 or higher)
* **npm** (v9 or higher)
* A free [Supabase](https://supabase.com) account

---

## 1. Clone the Repository

Clone the project from GitHub and navigate to the project root:

```bash
git clone https://github.com/DennisHengShuYi/ESG-Project-Management-tools.git
cd ESG-Project-Management-tools
```

---

## 2. Set Up a Supabase Project

1. Log in to [supabase.com](https://supabase.com) and go to the dashboard.
2. Click **New Project** and select/create an organization.
3. Choose a project name, database password, and region. **Save the database password securely**, as you will need it to run the database migration script.
4. Once the project is created, navigate to **Project Settings** (the gear icon on the left sidebar):
   * Under **API**:
     * Copy the **Project URL** (e.g., `https://your-project-ref.supabase.co`).
     * Copy the **`anon` (public)** API key.
     * Copy the **`service_role` (secret)** API key. *(Note: Do not share the service role key publicly. It is required for the database seeding scripts).*
   * Under **Database**:
     * Locate the **Connection string** (URI format) if you need the direct database host information, or just keep your database password handy.

---

## 3. Configure Environment Variables

Create the `.env` configuration files by copying the examples in both the `backend` and `frontend` directories.

### Backend Setup

Copy the example environment file:
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in the values:
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
JWT_SECRET=your-random-long-jwt-secret-key-here
# FRONTEND_ORIGIN=https://your-deployed-frontend.example.com
```
* **`PORT`**: The port that the Express backend will listen on (default is `5000`).
* **`SUPABASE_URL`**: Your Supabase project URL.
* **`SUPABASE_ANON_KEY`**: The client-side public anon key.
* **`SUPABASE_SERVICE_KEY`**: The secret service role key (bypasses RLS, used for administrative scripts/backend tasks).
* **`JWT_SECRET`**: A custom secure random string used to sign local user tokens.
* **`FRONTEND_ORIGIN`** *(optional)*: An extra allowed CORS origin, on top of the built-in `localhost:5173` / `localhost:3000` defaults. Only needed once you deploy the frontend somewhere other than localhost.

### Frontend Setup

Copy the example environment file:
```bash
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and verify the values:
```env
VITE_API_URL=http://localhost:5000
```
* **`VITE_API_URL`**: The URL of your local Express backend server (default is `http://localhost:5000`).

---

## 4. Set Up the Database & Seed Data

The project contains helper scripts in the `scripts/` directory to automatically apply the schema and seed mock data.

### Install Script Dependencies
From the repository root, install the dependencies for the setup scripts:
```bash
cd scripts
npm install
cd ..
```

### Apply Database Schema
You can apply the schema in one of two ways:

#### Option A: Direct Migration Script (Command Line)
Run the migration script while providing your database password (saved in Step 2).

* **Windows (PowerShell)**:
  ```powershell
  $env:DB_PASSWORD="your-database-password"
  node scripts/migrate.cjs
  ```
* **Windows (CMD)**:
  ```cmd
  set DB_PASSWORD=your-database-password
  node scripts/migrate.cjs
  ```
* **macOS / Linux**:
  ```bash
  DB_PASSWORD="your-database-password" node scripts/migrate.cjs
  ```

#### Option B: Supabase SQL Editor (Fallback)
If the migration script fails due to network/firewall settings:
1. Open your Supabase Dashboard and go to the **SQL Editor** on the left menu.
2. Click **New query**.
3. Open `supabase/schema.sql` in your text editor, copy its entire contents, and paste them into the SQL Editor.
4. Click **Run**.

---

### Seed the Demo Dataset
After the schema is applied, run the reseeding script to populate the database with mock ESG events, financials, timelines, and strategy modules spanning 2024–2026:

```bash
node scripts/reseed_events.js
```

### Verify Database Connection
Verify that the system can query the seeded data and that everything works end to end:

```bash
node scripts/test_system.cjs
```

---

## 5. Run the Application

Start both the backend and frontend servers.

### Start Backend Server
In a new terminal window:
```bash
cd backend
npm install
npm run dev
```
The backend server will run on `http://localhost:5000`.

### Start Frontend Server
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will run on `http://localhost:5173`. Open this URL in your web browser.

### Alternative: Run Both with Docker

Once steps 3-4 are done (env files filled in, schema applied, demo data
seeded), you can start both servers with Docker instead of installing Node
locally or juggling two terminals:

```bash
docker compose up --build
```

This builds and runs `backend` (`http://localhost:5000`) and `frontend`
(`http://localhost:5173`) together. Docker only replaces this step — you
still need your own Supabase project and a schema/seed applied first. The
containers don't hot-reload, so re-run with `--build` after changing
dependencies or source code.

---

## 6. Accessing the Application

1. Open your browser and navigate to `http://localhost:5173`.
2. To use the application, click on **Register** to create a user account.
3. During registration, you will be prompted for an **Organization Code / ID**. Enter the default seeded organization ID:
   ```text
   00000000-0000-0000-0000-000000000001
   ```
   *(This links your account to "Green Generation Events Sdn Bhd", which was created by the schema/seed scripts).*
4. Once registered, log in using your email and password to access the ESG dashboards, Event Lists, and reporting features.

---

## 7. Running End-to-End (E2E) Tests

The project includes E2E test suites powered by Playwright covering authentication, navigation, event CRUD, RBAC/permission gating, admin & team management, and the ESG dashboards (Dashboard, Governance, SDG, Reporting, Event Detail).

To run the tests:
1. Ensure both the frontend and backend servers are running.
2. In the `frontend` directory, run:
   ```bash
   cd frontend
   npm run test:e2e
   ```
3. To view the HTML test reports:
   ```bash
   npm run test:e2e:report
   ```
