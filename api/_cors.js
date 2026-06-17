const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://expense-tracker-frontend.vercel.app",
  "https://expense-tracker-frontend-five-inky.vercel.app",
  "https://expense-tracker-frontend-lyplbb0ib.vercel.app",
];

const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const configuredOrigins = () =>
  new Set([...defaultOrigins, ...parseOrigins(process.env.CORS_ORIGINS)]);

export const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  return configuredOrigins().has(origin.replace(/\/+$/, ""));
};

export const hasCrossOriginClient = () => configuredOrigins().size > 0;
