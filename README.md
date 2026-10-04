# EVE Healthcare — Diagnostic Test Booking & Payment Backend Service

Backend service for diagnostic test bookings and simulated payments built using **Node.js**, **Express**, and **PostgreSQL**.

---

## 🚀 Features Implemented (Minimal Requirements)

1. **Authentication**:
   - User signup with hashed passwords (`bcryptjs`).
   - User login generating standard JWT bearer tokens (`jsonwebtoken`).
   - Token-based route protection middleware.
   - Input validation (valid email format, password length, required fields).

2. **Diagnostic Centres & Tests**:
   - APIs to retrieve diagnostic centres and tests they offer.
   - APIs to register new centres and attach diagnostic tests with prices.
   - Seeded with initial diagnostic centres and tests on first startup.

3. **Booking System**:
   - Authenticated diagnostic test booking.
   - Tracks Patient/User, Centre, Test, Appointment Date/Time, Price/Amount, and Status.
   - Status flow: `PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`.
   - Ownership authorization checks (users can only access/cancel their own bookings).

4. **Simulated Payment Service**:
   - Endpoint: `POST /payments`
   - Simulates payment processing (`SUCCESS` or `FAILED`).
   - Automatically transitions booking state to `CONFIRMED` or `FAILED`.
   - Guards against double-payment and paying for cancelled bookings.

5. **Payment Webhook (Strict Idempotency)**:
   - Endpoint: `POST /payments/webhook`
   - Simulates webhook notifications from payment providers.
   - Tracks processed `event_id` in database.
   - If the same event is received repeatedly, returns success (`idempotent: true`) without creating duplicate payment records or corrupting the booking state.

6. **Edge-Case Handling**:
   - Missing or invalid request payloads (returns 400 Bad Request).
   - Non-existent booking IDs, centre IDs, or test IDs (returns 404 Not Found).
   - Test requested does not belong to the selected centre (returns 400 Bad Request).
   - Unauthorized access or attempts to modify others' bookings (returns 401 Unauthorized / 403 Forbidden).
   - Cannot cancel bookings that have already failed or are already cancelled.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Driver: `pg` / `node-postgres`)
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs

---

## 📋 Database Schema Design

```
+-------------------------------------------------------------------+
|                              USERS                                |
+-------------------------------------------------------------------+
| id (PK) | name | email (UNIQUE) | password (hashed) | created_at  |
+-------------------------------------------------------------------+
                                  |
                                  | 1:N
                                  v
+-----------------------+      +------------------------------------+
|  DIAGNOSTIC_CENTRES   |      |              BOOKINGS              |
+-----------------------+      +------------------------------------+
| id (PK)               |      | id (PK)                            |
| name                  |      | user_id (FK -> users)              |
| location              |<----+| centre_id (FK -> centres)          |
| created_at            |      | test_id (FK -> diagnostic_tests)   |
+-----------------------+      | appointment_date                   |
        |                      | amount                             |
        | 1:N                  | status [PENDING/CONFIRMED/FAILED/..|
        v                      | created_at, updated_at             |
+-----------------------+      +------------------------------------+
|   DIAGNOSTIC_TESTS    |                 |                 |
+-----------------------+                 | 1:N             | 1:N
| id (PK)               |                 v                 v
| centre_id (FK)        |<----+    +--------------+  +-------------------+
| name                  |     |    |   PAYMENTS   |  | WEBHOOK_EVENTS    |
| description           |     |    +--------------+  +-------------------+
| price                 |     |    | id (PK)      |  | id (PK)           |
| created_at            |     |    | booking_id   |  | event_id (UNIQUE) |
+-----------------------+     |    | amount       |  | booking_id        |
                              +----+ status       |  | status            |
                                   | txn_id (UQ)  |  | processed_at      |
                                   +--------------+  +-------------------+
```

---

## ⚙️ How to Run Locally

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- PostgreSQL running locally or in cloud (Neon / Supabase / Render)

### 2. Setup Environment
Clone the repository and install dependencies:
```bash
git clone <repo-url>
cd calm-newton
npm install
```

Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eve_healthcare
JWT_SECRET=super_secret_jwt_key_12345
JWT_EXPIRES_IN=24h
```
*(Make sure database `eve_healthcare` exists in your PostgreSQL instance: `CREATE DATABASE eve_healthcare;`)*

### 3. Start the Server
```bash
# Start server (tables and seed data are created automatically on launch)
npm start

# Or with live reload:
npm run dev
```

Server will run at `http://localhost:5000`.

---

## 📮 API Endpoints & Example Requests

### 1. Health Check
- **`GET /`**
```json
{
  "success": true,
  "message": "EVE Healthcare Backend API is running.",
  "version": "1.0.0"
}
```

---

### 2. Authentication
- **`POST /auth/signup`**
```json
// Request Body
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "password123"
}

// Response (201 Created)
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "user": { "id": 1, "name": "Rahul Sharma", "email": "rahul@example.com" },
    "token": "<JWT_TOKEN>"
  }
}
```

- **`POST /auth/login`**
```json
// Request Body
{
  "email": "rahul@example.com",
  "password": "password123"
}
```

- **`GET /auth/me`** (Headers: `Authorization: Bearer <JWT_TOKEN>`)

---

### 3. Diagnostic Centres & Tests
- **`GET /centres`** — List all centres along with their available diagnostic tests and prices.
- **`GET /centres/:id`** — Get a single centre by ID.
- **`POST /centres`** — Create a new centre (`Authorization: Bearer <JWT_TOKEN>`):
```json
{
  "name": "EVE Diagnostic Express",
  "location": "Indiranagar, Bangalore"
}
```
- **`POST /centres/:id/tests`** — Add a test to a centre (`Authorization: Bearer <JWT_TOKEN>`):
```json
{
  "name": "Full Body Comprehensive Checkup",
  "description": "64 vital health parameters",
  "price": 1999.00
}
```

---

### 4. Booking System
- **`POST /bookings`** (`Authorization: Bearer <JWT_TOKEN>`):
```json
// Request Body
{
  "centre_id": 1,
  "test_id": 1,
  "appointment_date": "2026-10-15T09:30:00Z"
}

// Response (201 Created)
{
  "success": true,
  "message": "Booking initiated successfully. Please proceed to payment.",
  "data": {
    "id": 1,
    "user_id": 1,
    "centre_id": 1,
    "test_id": 1,
    "appointment_date": "2026-10-15T09:30:00.000Z",
    "amount": "450.00",
    "status": "PENDING",
    "patient_name": "Rahul Sharma",
    "centre_name": "EVE Central Diagnostic Hub",
    "test_name": "Complete Blood Count (CBC)"
  }
}
```

- **`GET /bookings`** — Retrieve all bookings for the logged-in user.
- **`GET /bookings/:id`** — Retrieve booking details (Protected: Only booking owner can view).
- **`POST /bookings/:id/cancel`** — Cancel a booking (Protected: Only booking owner can cancel).

---

### 5. Simulated Payment Service
- **`POST /payments`** (`Authorization: Bearer <JWT_TOKEN>`):
```json
// Request Body
{
  "booking_id": 1,
  "status": "SUCCESS" // or "FAILED"
}

// Response (200 OK)
{
  "success": true,
  "message": "Payment simulated: SUCCESS",
  "data": {
    "payment": {
      "id": 1,
      "booking_id": 1,
      "amount": "450.00",
      "status": "SUCCESS",
      "transaction_id": "TXN_7F89B2"
    },
    "booking_status": "CONFIRMED"
  }
}
```

---

### 6. Payment Webhook (Idempotent)
- **`POST /payments/webhook`**:
```json
// Request Body
{
  "event_id": "evt_gateway_1001",
  "booking_id": 1,
  "status": "SUCCESS",
  "transaction_id": "TXN_PG_1001"
}

// First Call Response (200 OK)
{
  "success": true,
  "idempotent": false,
  "message": "Webhook processed successfully. Booking status updated to CONFIRMED.",
  "data": { ... }
}

// Replaying the exact same request (Idempotency guarantee)
{
  "success": true,
  "idempotent": true,
  "message": "Webhook event was already processed previously. No duplicate actions taken.",
  "data": { ... }
}
```

---

## 🧪 Testing with Postman
Import the included `postman_collection.json` directly into Postman:
1. Open Postman -> Click **Import** -> Select `postman_collection.json`.
2. The collection has automatic token saving upon login/signup, so you can execute the requests in sequence.

---

## 💡 Important Assumptions Made
1. **Dynamic Pricing Integrity**: Amount for any booking is fetched directly from the database's `diagnostic_tests.price` instead of trusting user input from the request body.
2. **Centre-Test Binding**: A test can only be booked if it is actively offered by the specified centre.
3. **Webhook Idempotency Key**: The `event_id` sent by payment providers serves as the natural idempotency key. A dedicated `processed_webhook_events` table ensures repeat events never lead to double bookings, double charges, or corrupt states.
4. **State Machine Integrity**: A booking that has already been `CONFIRMED` cannot be paid for again. A booking that has been `CANCELLED` cannot be updated to `CONFIRMED` by delayed webhooks.

---

## 🔮 What I Would Improve If I Had More Time
1. **Automated Integration Tests**: Add a suite of end-to-end API tests using Jest and Supertest.
2. **Database Migrations**: Adopt a schema migration tool (like `db-migrate` or Prisma) instead of programmatic DDL scripts.
3. **Refresh Tokens**: Implement short-lived access tokens with rotating refresh tokens stored in HttpOnly cookies.
4. **Time Slot Capacity**: Add centre scheduling capacity limits to prevent overbooking the same time slot.
