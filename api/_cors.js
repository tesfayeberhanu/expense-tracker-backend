export const configuredOrigins = () =>
  new Set(
    String(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );

export const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  return configuredOrigins().has(origin.replace(/\/+$/, ""));
};

export const hasCrossOriginClient = () => configuredOrigins().size > 0;
