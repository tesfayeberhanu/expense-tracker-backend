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
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/configuration`
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/password`
- `PUT /api/username`
