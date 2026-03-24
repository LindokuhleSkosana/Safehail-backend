# SafeHail Backend

Production backend for [SafeHail](https://safehail.co.za) — a real-time safety platform for e-hailing drivers in South Africa.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL 15 + PostGIS |
| Real-time | Socket.IO 4 |
| Cache / Queues | Redis + BullMQ |
| Auth | JWT (access + refresh) + OTP via Africa's Talking |
| Push | Firebase Admin SDK (FCM) |
| Payments | RevenueCat webhook receiver |
| Storage | AWS S3 |
| Hosting | Railway / Render |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15 with PostGIS extension
- Redis 7+

### Setup

```bash
npm install
cp .env.example .env
# fill in .env values
npm run migrate
npm run dev
```

### Production build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t safehail-backend .
docker run -p 4000:4000 --env-file .env safehail-backend
```

## API Reference

All endpoints: `/api/v1/...`. See README for full table.

### Auth
- `POST /auth/register` — phone + password, sends OTP
- `POST /auth/verify-otp` — verify OTP → JWT pair
- `POST /auth/login` — login, sends OTP
- `POST /auth/refresh` — refresh access token
- `POST /auth/logout` — invalidate refresh token

### Drivers
- `POST /drivers/profile` — upsert profile
- `GET /drivers/profile` — get own profile
- `POST /drivers/device-token` — register FCM token

### Presence
- `POST /presence/online`, `POST /presence/offline`
- `GET /presence/nearby?lat=&lng=&radius=`

### Emergency
- `POST /emergency/trigger`
- `GET/POST /emergency/:sessionId`
- `POST /emergency/:sessionId/cancel|resolve|location`

### Responders
- `POST /responders/:sessionId/accept|decline|arrived`

### Trusted Contacts
- `GET/POST/PUT/DELETE /trusted-contacts[/:contactId]`

### Subscriptions
- `GET /subscriptions/status`
- `POST /subscriptions/revenuecat-webhook`

### Incidents — `GET /incidents[/:id]`

### AI Events (feature-flagged)
- `POST /ai/ingest`, `GET /ai/flags`

### Admin (role=admin)
- `GET /admin/users|incidents|ai-events|audit-logs`
- `POST /admin/users/:id/suspend`

## Socket.IO Events

**Client → Server:** `presence:go_online`, `presence:go_offline`, `location:update`, `emergency:location_update`

**Server → Client:** `emergency:new`, `emergency:status_changed`, `emergency:responder_accepted`, `emergency:location_update`, `responder:eta_update`

## Emergency Workflow

1. `POST /emergency/trigger` → session created (`broadcasting`)
2. PostGIS `ST_DWithin` finds online drivers within 5km
3. FCM high-priority push sent to each
4. `emergency:new` socket emitted to online drivers in range
5. Trusted contacts notified
6. BullMQ auto-timeout job scheduled (30 min)

## Migrations

```bash
npm run migrate
```

Plain SQL files in `src/db/migrations/`, tracked in `schema_migrations` table.

## Security

- JWT: 15m access / 7d refresh, stored in Redis, invalidated on logout
- OTP: 6 digits, 5-min expiry, 3-attempt lockout, Africa's Talking SMS
- bcrypt: 12 rounds
- Rate limits: 10/min auth, 60/min general, 10/hour emergency trigger
- All sensitive actions in `audit_logs`
- `password_hash` never returned
- RevenueCat webhook: HMAC-SHA256 signature validation
