# LBK Finance Backend

Standalone Express and Mongoose API for LBK Finance.

## Local development

```sh
cp .env.example .env
npm install
npm start
```

Required environment variable:

- `MONGO_URI`: MongoDB connection string
- `BOOTSTRAP_USERNAME` and `BOOTSTRAP_PASSWORD`: first admin account. If this
  user already exists, it is promoted to admin on login.
- `CORS_ORIGINS`: optional comma-separated browser origins allowed to call the
  API directly. `https://lbk-finance.vercel.app`,
  `https://tbk-expense-tracker.vercel.app`, and localhost development origins
  are allowed by default. Add any additional deployed client domains here.

The server listens on `PORT`, defaulting to `8080`.

## DigitalOcean App Platform

Create a Web Service from the
`tesfayeberhanu/expense-tracker-backend` GitHub repository:

- Branch: `main`
- Run command: `npm start`
- HTTP port: `8080` if you configure `PORT=8080`; otherwise let
  DigitalOcean inject `PORT`
- Health check path: `/healthz`
- Encrypted runtime variable: `MONGO_URI`
- Runtime variable: set `CORS_ORIGINS` only for additional deployed client
  domains beyond the default deployed frontend domains.

After DigitalOcean reports the service healthy, point your browser client or
reverse proxy at the DigitalOcean service. Do not expose `MONGO_URI` outside the
backend runtime.

## API

Public:

- `GET /healthz`
- `POST /api/login`

Requires a valid MongoDB-backed session:

- `GET /api/session`
- `POST /api/logout`
- `GET /api/operators` admin only; returns operators and assignable permissions
- `POST /api/operators` admin only; creates an operator
- `PUT /api/operators/:id` admin only; updates username, password, active state,
  or permissions
- `DELETE /api/operators/:id` admin only; deactivates an operator
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/configuration`
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/password`
- `PUT /api/username`

## Roles and permissions

Admins can manage operators, settings, transactions, and reports. Operators are
normal users with assigned permissions. The default operator permissions are:

- `transactions:create`
- `transactions:read`
- `reports:view`
- `settings:read`
- `configuration:read`

Available permissions are returned by `GET /api/operators` so the frontend can
render an operator-permissions form dynamically.
