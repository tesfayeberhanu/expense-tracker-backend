const defaultOrigins = ["https://lbk-finance.vercel.app"];
const localDevelopmentOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const configuredOrigins = () =>
  new Set([...defaultOrigins, ...parseOrigins(process.env.CORS_ORIGINS)]);

export const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return (
    configuredOrigins().has(normalizedOrigin) ||
    localDevelopmentOrigin.test(normalizedOrigin)
  );
};

export const hasCrossOriginClient = () => configuredOrigins().size > 0;
