const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const configuredOrigins = () =>
  new Set(parseOrigins(process.env.CORS_ORIGINS));

export const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  return configuredOrigins().has(origin.replace(/\/+$/, ""));
};

export const hasCrossOriginClient = () => configuredOrigins().size > 0;
