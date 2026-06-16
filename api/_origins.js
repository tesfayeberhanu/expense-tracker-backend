const defaultTrustedOrigins = [
  "https://lbk-finance.vercel.app",
  "https://expense-tracker-frontend-five-inky.vercel.app",
];

const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const projectVercelPattern =
  /^https:\/\/expense-tracker-frontend(?:-[a-z0-9-]+)?\.vercel\.app$/;
const branchVercelPattern =
  /^https:\/\/expense-tracker-frontend-git-[a-z0-9-]+-teneshuberhanu-3636s-projects\.vercel\.app$/;

export const configuredOrigins = () =>
  new Set(
    [
      ...defaultTrustedOrigins,
      ...String(process.env.FRONTEND_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ].map((origin) => origin.replace(/\/+$/, "")),
  );

export const isTrustedOrigin = (origin) => {
  if (!origin) return false;

  const normalizedOrigin = origin.replace(/\/+$/, "");
  return (
    configuredOrigins().has(normalizedOrigin) ||
    localhostPattern.test(normalizedOrigin) ||
    projectVercelPattern.test(normalizedOrigin) ||
    branchVercelPattern.test(normalizedOrigin)
  );
};

export const hasCrossOriginFrontend = () => configuredOrigins().size > 0;
