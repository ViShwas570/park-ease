# REASONING.md — Thought Process Behind ParkEase

## 1. Problem Analysis

The problem statement describes a **multi-level city-centre parking garage** where an attendant needs to:
- Check cars in and out
- Charge the correct fee using **tiered pricing** (first hour premium, additional hours cheaper, daily cap, part-hours rounded up)
- Handle three spot types: **compact**, **standard**, **EV** (with charger)
- Enforce that **EVs must get EV spots**
- Let drivers quickly check if EV spots are available
- Search for a car by its plate number
- Prevent **double-parking** (one car per spot)

The twist/emphasis: *"build it for any garage, not one"* — so the system should be configurable (multiple levels, adjustable pricing, flexible spot layout).

### Key Constraints Identified
1. Tiered pricing is not a flat rate — requires calculation logic
2. EV enforcement is strict (not a soft preference)
3. "Part-hours round up" means `Math.ceil()` on duration
4. Daily cap means `Math.min(calculated_fee, daily_cap)`
5. Double-parking prevention requires transactional updates

---

## 2. Design Decisions

### Why SQLite?
- **Zero configuration** — no separate database server to install
- **Real persistence** — file-based, survives server restarts
- **Full SQL support** — JOINs, transactions, indexes
- **Perfect for the scale** — a single garage doesn't need PostgreSQL
- `better-sqlite3` is synchronous, which simplifies Express route handlers

### Why Express + Vanilla Frontend?
- **Express** is the most battle-tested Node.js framework for REST APIs
- **Vanilla HTML/CSS/JS** avoids build steps — `npm start` and it works
- No React/Vue/Angular overhead — faster to build, easier to debug, zero tooling issues

### Why JWT for Auth?
- **Stateless** — no session store needed
- Industry-standard for REST APIs
- 24-hour expiry balances security and usability
- `bcryptjs` (pure JS) over `bcrypt` to avoid native compilation issues

### Database Schema Design
- **Normalized** — separate tables for levels, spots, pricing, users
- **Foreign keys enforced** — `PRAGMA foreign_keys = ON`
- **Indexes** on `plate_number`, `check_out_time`, `spot_type`, `is_occupied` for fast lookups
- **Separation of concerns** — pricing is a separate table so admins can update rates without touching code

### Spot Assignment Algorithm
1. For **EV vehicles** → only look at `spot_type = 'ev'` — if none available, reject (don't downgrade)
2. For **compact vehicles** → try compact spots first, then overflow to standard
3. For **standard vehicles** → only standard spots
4. This ensures EV spots are reserved exclusively for EVs

### Fee Calculation
```
duration = ceil((checkOutTime - checkInTime) / 1 hour)
fee = first_hour_rate + (duration - 1) * additional_hour_rate
fee = min(fee, daily_cap)
```
- If duration ≤ 0 (immediate checkout), fee = 0
- If duration = 1, fee = first_hour_rate only
- Daily cap prevents absurd charges for overnight parking

---

## 3. Architecture

```
Client (Browser)
    ↓ HTTP/REST
Express Server (server.js)
    ↓ Routes → Middleware (JWT auth)
    ↓ 
SQLite Database (parkease.db)
```

- All API routes are under `/api/` prefix
- Static files served from `/public/`
- Each frontend page has its own JS file for separation
- Shared `api.js` handles token management, fetch wrapper, toasts

---

## 4. Testing Approach

### Manual Testing Performed
1. **Auth flow**: Register → Login → Token stored → Protected routes work → Logout clears token
2. **Check-in**: 
   - Valid check-in creates record, marks spot occupied
   - Duplicate plate rejected ("already checked in")
   - EV vehicle with no EV spots → rejected with clear error
   - Compact car with no compact spots → overflows to standard
3. **Check-out**:
   - Fee calculated correctly for various durations (1h, 3h, 8h, 24h)
   - Part-hour rounding: 1h 5min → billed as 2 hours
   - Daily cap applied: 24h standard parking = ₹200 (not ₹40 + 23×₹20 = ₹500)
   - Spot freed after checkout
4. **Double-parking prevention**: Tried checking in a second car to an occupied spot — rejected
5. **Search**: Partial plate match works (searching "MH" finds all MH-registered cars)
6. **Pagination**: Tested with multiple records, page navigation works correctly
7. **Sorting**: Verified sort by plate, fee, check-in time, duration all work

### Edge Cases Handled
- Empty database (first run with seed data)
- Invalid vehicle type → 400 error
- Checking out an already-checked-out vehicle → 404
- Non-admin trying to edit pricing → 403
- Expired JWT → 401 with redirect to login

---

## 5. Issues Found and Fixed

### Issue 1: UTC vs Local Time
**Problem**: SQLite stores datetime in UTC, but the frontend was showing raw UTC strings.
**Fix**: Added `formatDate()` helper that converts UTC to local time using `toLocaleString('en-IN')`.

### Issue 2: EV Spot Leakage
**Problem**: Initially, compact cars could be assigned to EV spots as overflow.
**Fix**: Added explicit check — only EV vehicles can use EV spots. Compact overflow only goes to standard.

### Issue 3: Double-Parking Race Condition
**Problem**: Two simultaneous check-in requests could theoretically grab the same spot.
**Fix**: Wrapped spot assignment + record creation in a SQLite transaction. Since `better-sqlite3` is synchronous, this guarantees atomicity.

### Issue 4: Fee Calculation for < 1 Hour
**Problem**: A car parked for 5 minutes was being charged for 0 hours (₹0).
**Fix**: `Math.ceil()` ensures minimum 1 hour charge (part-hours round up as per spec).

---

## 6. What I'd Improve With More Time

1. **WebSocket live updates** — dashboard auto-refreshes when a car is checked in/out
2. **Report generation** — daily/weekly revenue reports with CSV export
3. **Rate limiting** — prevent brute-force login attempts
4. **Input validation library** — use `joi` or `zod` for schema validation
5. **Automated tests** — Jest + Supertest for API endpoint testing
