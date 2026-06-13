# Expense Tracker

A small Express and MongoDB ledger for tracking FOREX and USDT expenses and
conversions.

## Setup

Install Node.js 20.19 or newer, then:

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3001`. The application serves the dashboard and API from
the same process.

## Commands

- `npm start` starts the production server.
- `npm run dev` starts the server with Node's watch mode.
- `npm test` runs the API route tests.

## API

- `GET /api/health`
- `GET /api/transactions`
- `POST /api/transactions`
- `PATCH /api/transactions/:id/toggle`
- `DELETE /api/transactions/:id`

Set `CORS_ORIGIN` when a separately hosted frontend needs API access. The
dashboard's current sign-in screen is client-side only; add server-side
authentication before exposing this application publicly.
