# Expense Tracker

A small Express and MongoDB ledger for tracking FOREX and USDT expenses and
conversions.

## Setup

Install Node.js 20.19 or newer, then:

```bash
cp .env.example .env
npm install
npm run auth:hash
npm start
```

Put the generated password hash in `AUTH_PASSWORD_HASH`, choose an
`AUTH_USERNAME`, and generate a strong session secret:

```bash
openssl rand -base64 48
```

Put that output in `AUTH_SECRET`. For Vercel, configure `MONGO_URI`,
`AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `AUTH_SECRET`, and `NODE_ENV=production`
as encrypted project environment variables. Never commit `.env`.

The previous dashboard password was visible in browser source and must not be
reused. The existing deployment remains publicly accessible until you set the
new variables and redeploy this version. If the MongoDB URI was ever shared,
rotate that database user's password too.

Open `http://localhost:3001`. The application serves the dashboard and API from
the same process.

## Commands

- `npm start` starts the production server.
- `npm run dev` starts the server with Node's watch mode.
- `npm run auth:hash` securely prompts for a password and prints its scrypt hash.
- `npm test` runs the API route tests.

## API

- `GET /api/health`
- `GET /api/transactions`
- `POST /api/transactions`
- `PATCH /api/transactions/:id/toggle`
- `DELETE /api/transactions/:id`

All API routes require a signed, `HttpOnly`, same-site session cookie except
`POST /api/auth/login` and `POST /api/auth/logout`. Authentication configuration
is mandatory, so the server refuses to start if its credentials or session
secret are missing.
