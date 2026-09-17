# 🅿️ ParkEase — Multi-Level Parking Garage Management System

> **Live Demo**: [https://parkease.vercel.app](https://parkease.vercel.app) *(update this URL after deployment)*

A full-stack web application that helps parking attendants manage multi-level garages efficiently. Real-time spot tracking, tiered pricing with daily caps, EV spot enforcement, and a premium dark-mode dashboard.

---

## 📖 Table of Contents

1. [How It Works](#-how-it-works)
2. [Quick Start (Local)](#-quick-start-local)
3. [Vercel Deployment (Production)](#-vercel-deployment-production)
4. [Default Login Credentials](#-default-login-credentials)
5. [Using the Application](#-using-the-application)
6. [Tech Stack](#-tech-stack)
7. [Project Structure](#-project-structure)
8. [API Endpoints](#-api-endpoints)
9. [Database Schema](#-database-schema)
10. [Pricing Logic](#-pricing-logic)
11. [EV Spot Rules](#-ev-spot-rules)
12. [Debugging](#-debugging)

---

## 🧠 How It Works

ParkEase is a **monolithic full-stack app** — the server handles both the API and serves the frontend.

```
┌──────────────────────────────────────────────────────┐
│                    Browser (Client)                   │
│  index.html │ dashboard.html │ checkin.html │ ...     │
│            Vanilla HTML + CSS + JavaScript            │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP REST (JSON)
┌──────────────────────▼───────────────────────────────┐
│                  Express.js Server                    │
│  server.js ──► routes/ ──► middleware/auth.js (JWT)   │
└──────────────────────┬───────────────────────────────┘
                       │ SQL queries
┌──────────────────────▼───────────────────────────────┐
│              SQLite Database (sql.js)                 │
│   Local: parkease.db file │ Vercel: in-memory         │
└──────────────────────────────────────────────────────┘
```

- **There is NO separate client server.** The Express server serves both the API (`/api/*`) and the frontend (`/public/*` as static files) on the **same port**.
- **You only need to start ONE server.** Open the browser to that server's URL and the full app loads.

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Node.js** v18 or higher (check with `node -v`)
- **npm** (comes with Node.js, check with `npm -v`)

### Step 1: Install Dependencies

```bash
cd lab
npm install
```

This installs Express, sql.js (SQLite), bcryptjs, jsonwebtoken, and cors.

### Step 2: Start the Server

```bash
npm start
```

You will see:

```
✅ Database initialized

  ╔═══════════════════════════════════════════╗
  ║         🅿️  ParkEase Server               ║
  ║   Multi-Level Parking Garage Management   ║
  ╠═══════════════════════════════════════════╣
  ║   🌐  http://localhost:3000              ║
  ║   📊  API: http://localhost:3000/api     ║
  ║   🔑  Default admin: admin / admin123     ║
  ╚═══════════════════════════════════════════╝
```

### Step 3: Open the App

Open your browser and go to:

| What | URL |
|------|-----|
| **Landing Page** | [http://localhost:3000](http://localhost:3000) |
| **Login** | [http://localhost:3000/login.html](http://localhost:3000/login.html) |
| **Dashboard** (after login) | [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html) |
| **API Health Check** | [http://localhost:3000/api/health](http://localhost:3000/api/health) |

> **That's it!** No separate frontend server needed. Everything runs on `localhost:3000`.

### Development Mode (auto-restart on file changes)

```bash
npm run dev
```

Uses Node.js `--watch` flag to restart automatically when you edit server files.

### Stopping the Server

Press `Ctrl + C` in the terminal.

---

## ☁️ Vercel Deployment (Production)

The project is pre-configured for Vercel with `vercel.json` and `api/index.js`.

### Option A: Deploy via CLI

```bash
# Install Vercel CLI globally (one time)
npm i -g vercel

# Deploy from the project root
cd lab
vercel
```

Follow the prompts. On first deploy, use these settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Other` |
| **Root Directory** | `./` (default) |
| **Build Command** | *leave empty (no build step)* |
| **Output Directory** | *leave empty* |
| **Install Command** | `npm install` |

For production deployment:

```bash
vercel --prod
```

### Option B: Deploy via GitHub (Recommended)

1. Push your code to a **public GitHub repository**
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Settings:
   - Framework: **Other**
   - Build Command: *(leave empty)*
   - Install Command: `npm install`
5. Click **Deploy**

Every push to `main` will auto-deploy.

### How It Works on Vercel

| Component | Local | Vercel |
|-----------|-------|--------|
| **Server** | Express on port 3000 | Serverless function (`api/index.js`) |
| **Frontend** | Served by Express from `public/` | Served by Vercel CDN from `public/` |
| **Database** | File-based (`parkease.db`) | In-memory (re-seeds on cold start) |
| **Auth (JWT)** | Works normally | Works normally (stateless) |

> ⚠️ **Note**: On Vercel, the database is in-memory. Data persists as long as the serverless function stays warm (~5-15 min). On cold start, it re-seeds with default data (4 levels, 85 spots, default admin user, pricing tiers).

---

## 🔑 Default Login Credentials

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| `admin` | `admin123` | Admin | Full access + edit pricing |

New users can register via the **Register** page — they get the "attendant" role by default (can do everything except edit pricing).

---

## 📱 Using the Application

### 1. Landing Page (`/`)

The public-facing page explaining what ParkEase is, its features, target audience, and future roadmap. Contains links to Login and Register.

### 2. Login (`/login.html`) & Register (`/register.html`)

- **Login** with username (or email) + password
- **Register** with username, email, password (min 6 characters)
- After login, you're redirected to the Dashboard
- Demo credentials shown on the login page

### 3. Dashboard (`/dashboard.html`)

The main overview screen showing:
- **Occupancy rate** — percentage of all spots filled
- **Today's revenue** — total fees collected today
- **Cars currently parked** — active count
- **Today's check-ins** — total check-ins today
- **Spot availability by type** — compact/standard/EV with progress bars
- **Level-wise occupancy** — per-floor breakdown
- **Recent activity** — last 5 parking operations

### 4. Check In (`/checkin.html`)

1. Enter the **license plate number** (e.g., `MH 12 AB 1234`)
2. Select **vehicle type** (Compact, Standard, or EV)
3. Click **Check In Vehicle**
4. System automatically assigns the best available spot
5. A confirmation card shows the assigned spot and level

**Rules enforced:**
- EVs must get an EV spot (rejected if none available)
- Compact cars overflow to standard spots if no compact spots free
- Duplicate plates rejected (can't check in a car that's already parked)

### 5. Check Out (`/checkout.html`)

1. **Search** by plate number, or click **Show All Active Vehicles**
2. Click **Check Out** on the vehicle row
3. Confirm in the modal dialog
4. System calculates the fee automatically (tiered pricing + daily cap)
5. A detailed **receipt** is shown with pricing breakdown

### 6. Parking Log (`/log.html`)

Full history of all parking records with:
- **Search** by plate number (partial match supported)
- **Sort** by any column (check-in time, plate, type, fee, duration)
- **Pagination** (10 records per page)
- Status badges (Active / Completed)

### 7. Spot Map (`/spots.html`)

Visual grid of every parking spot across all levels:
- 🟢 **Green** = Available
- 🔴 **Red** = Occupied (shows plate number)
- **Filter** by spot type (compact/standard/EV) and status (available/occupied)
- Per-level occupancy progress bars

### 8. Pricing (`/pricing.html`)

View pricing tiers for each vehicle type:
- First hour rate, additional hour rate, daily cap
- Example calculation shown on each card
- **Admin only**: Click **Edit** to modify pricing rates

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend** | Node.js + Express.js | Fast REST API, minimal setup |
| **Database** | SQLite via `sql.js` | Pure JS, zero native compilation, real SQL |
| **Auth** | JWT + bcryptjs | Stateless tokens, secure password hashing |
| **Frontend** | Vanilla HTML/CSS/JS | No build step, instant load, zero tooling |
| **Design** | Custom dark glassmorphism CSS | Premium look, responsive, micro-animations |
| **Hosting** | Vercel | Serverless, free tier, auto-deploy from GitHub |

---

## 📁 Project Structure

```
lab/
├── server.js                  # Express entry point (local dev)
├── package.json               # Dependencies & scripts
├── vercel.json                # Vercel deployment config
├── .gitignore                 # Files excluded from git
│
├── api/
│   └── index.js               # Vercel serverless function entry point
│
├── database/
│   └── db.js                  # SQLite schema, seed data, helpers
│
├── middleware/
│   └── auth.js                # JWT authentication middleware
│
├── routes/
│   ├── auth.js                # POST /api/auth/register, login, GET /me
│   ├── parking.js             # POST check-in/out, GET active/history/search
│   ├── spots.js               # GET spots, available, levels
│   ├── pricing.js             # GET/PUT pricing tiers
│   └── dashboard.js           # GET dashboard stats
│
├── public/                    # Frontend (served as static files)
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── dashboard.html         # Main dashboard
│   ├── checkin.html           # Vehicle check-in
│   ├── checkout.html          # Vehicle check-out + receipt
│   ├── log.html               # Parking history log
│   ├── spots.html             # Visual spot map
│   ├── pricing.html           # Pricing tiers
│   ├── css/
│   │   └── style.css          # Global premium dark theme
│   └── js/
│       ├── api.js             # Shared API client + JWT + helpers
│       ├── landing.js         # Landing page logic
│       ├── auth.js            # Login/register form handling
│       ├── dashboard.js       # Dashboard data loading
│       ├── checkin.js         # Check-in form + availability
│       ├── checkout.js        # Check-out search + receipt
│       ├── log.js             # History table + pagination
│       ├── spots.js           # Spot grid + filters
│       └── pricing.js         # Pricing cards + admin edit
│
├── README.md                  # This manual
├── REASONING.md               # Design rationale & thought process
└── AI_LOGS.md                 # AI conversation log
```

---

## 📡 API Endpoints

All API endpoints are prefixed with `/api`. Protected endpoints require a JWT token in the `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register — body: `{ username, email, password }` |
| `POST` | `/api/auth/login` | ❌ | Login — body: `{ username, password }` → returns JWT |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |

### Parking Operations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/parking/check-in` | ✅ | Check in — body: `{ plate_number, vehicle_type }` |
| `POST` | `/api/parking/check-out/:id` | ✅ | Check out by record ID → returns receipt with fee |
| `GET` | `/api/parking/active` | ✅ | Currently parked vehicles (`?page=&limit=&sortBy=&order=`) |
| `GET` | `/api/parking/history` | ✅ | Full log (`?page=&limit=&sortBy=&order=`) |
| `GET` | `/api/parking/search` | ✅ | Search by plate (`?plate=MH12&page=&limit=`) |

### Spots & Levels

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/spots` | ✅ | All spots (`?type=&level_id=&status=&page=&limit=`) |
| `GET` | `/api/spots/available` | ✅ | Available spots (`?type=`) + summary |
| `GET` | `/api/spots/levels` | ✅ | All levels with occupancy |
| `GET` | `/api/spots/levels/:id/spots` | ✅ | Spots on a specific level |

### Pricing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/pricing` | ✅ | Get all pricing tiers |
| `PUT` | `/api/pricing/:id` | ✅ Admin | Update pricing — body: `{ first_hour_rate, additional_hour_rate, daily_cap }` |

### Dashboard & Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/dashboard/stats` | ✅ | Occupancy, revenue, activity stats |
| `GET` | `/api/health` | ❌ | Server health check |

---

## 🗄️ Database Schema

### Users
`id` (PK) · `username` (unique) · `email` (unique) · `password_hash` · `role` (admin/attendant) · `created_at`

### Levels
`id` (PK) · `name` · `total_spots`

### Spots
`id` (PK) · `level_id` (FK→levels) · `spot_number` · `spot_type` (compact/standard/ev) · `is_occupied`

### Parking Records
`id` (PK) · `spot_id` (FK→spots) · `plate_number` · `vehicle_type` · `check_in_time` · `check_out_time` · `duration_hours` · `fee` · `checked_in_by` (FK→users)

### Pricing
`id` (PK) · `vehicle_type` (unique) · `first_hour_rate` · `additional_hour_rate` · `daily_cap`

**Seed data** (auto-created on first run):
- 4 levels: Ground Floor, Level 1, Level 2, Level B1 (Basement)
- 85 spots: ~30% compact, ~55% standard, ~15% EV
- 3 pricing tiers (see below)
- 1 admin user (`admin` / `admin123`)

---

## 💰 Pricing Logic

```
duration = ceil((checkOutTime - checkInTime) / 1 hour)   ← part-hours round UP
fee      = first_hour_rate + (duration - 1) × additional_hour_rate
fee      = min(fee, daily_cap)                            ← cap prevents overcharging
```

| Type | 1st Hour | Each Additional Hour | Daily Cap |
|------|----------|---------------------|-----------|
| Compact | ₹30 | ₹15/hr | ₹150 |
| Standard | ₹40 | ₹20/hr | ₹200 |
| EV | ₹50 | ₹25/hr | ₹250 |

**Examples:**
- Compact, 45 min → ceil(0.75) = 1 hour → **₹30**
- Standard, 3h 10m → ceil(3.17) = 4 hours → ₹40 + 3×₹20 = **₹100**
- Standard, 24h → ₹40 + 23×₹20 = ₹500 → capped at **₹200**

---

## 🔌 EV Spot Rules

- EV vehicles **must** be assigned an EV spot (with charger) — rejected if none available
- Non-EV vehicles **cannot** be assigned to EV spots
- Compact vehicles can overflow into standard spots if compact spots are full
- No double-parking: occupied spots cannot be reassigned until the car leaves

---

## 🐛 Debugging

| Issue | Solution |
|-------|---------|
| Server won't start | Check Node.js version (`node -v`, need v18+). Run `npm install` first. |
| "Cannot find module" | Run `npm install` in the project root |
| Database seems empty | Delete `parkease.db` and restart — it auto-seeds |
| API returns 401 | Login again to get a fresh JWT token (expires after 24h) |
| API returns 403 | You need admin role for that endpoint (login as `admin`) |
| Port 3000 in use | Kill the other process or set `PORT=3001 npm start` |
| Vercel deploy fails | Check `vercel.json` exists, framework set to "Other", no build command |

**Log locations:**
- Server errors → printed to terminal console
- API errors → returned as `{ "error": "description" }` with HTTP status codes
- Database file → `parkease.db` in project root (local only, not on Vercel)
