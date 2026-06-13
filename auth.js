const {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function safeEqual(left, right) {
  const leftDigest = createHash("sha256").update(String(left)).digest();
  const rightDigest = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must be at least 12 characters long");
  }

  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${digest.toString("base64url")}`;
}

function verifyPassword(password, passwordHash) {
  const [algorithm, saltValue, digestValue] = String(passwordHash).split(":");
  if (algorithm !== "scrypt" || !saltValue || !digestValue) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(digestValue, "base64url");
    const actual = scryptSync(String(password), salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validPasswordHash(passwordHash) {
  const [algorithm, saltValue, digestValue] = String(passwordHash).split(":");
  if (algorithm !== "scrypt" || !saltValue || !digestValue) {
    return false;
  }

  try {
    return (
      Buffer.from(saltValue, "base64url").length === 16 &&
      Buffer.from(digestValue, "base64url").length === 64
    );
  } catch {
    return false;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, value.join("=")]),
  );
}

function createSessionToken(username, secret) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token, secret, username) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      safeEqual(session.username, username) &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

function sessionCookie(
  name,
  value,
  secureCookies,
  maxAge = SESSION_DURATION_SECONDS,
) {
  const attributes = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];

  if (secureCookies) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function createAuth({ username, passwordHash, secret, secureCookies = false }) {
  if (!username) {
    throw new Error("AUTH_USERNAME is required");
  }
  if (!validPasswordHash(passwordHash)) {
    throw new Error("AUTH_PASSWORD_HASH must be a valid scrypt password hash");
  }
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long");
  }

  const loginAttempts = new Map();
  const cookieName = secureCookies
    ? "__Host-expense_session"
    : "expense_session";

  function authenticated(req) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    return verifySessionToken(token, secret, username);
  }

  function requireAuth(req, res, next) {
    if (!authenticated(req)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    return next();
  }

  function session(_req, res) {
    return res.json({ authenticated: true, username });
  }

  function login(req, res) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const recentAttempts = (loginAttempts.get(key) || []).filter(
      (attempt) => now - attempt < LOGIN_WINDOW_MS,
    );

    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      res.set("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
      return res.status(429).json({ error: "Too many login attempts" });
    }

    const submittedUsername = req.body?.username;
    const submittedPassword = req.body?.password;
    const validUsername = safeEqual(submittedUsername, username);
    const validPassword = verifyPassword(submittedPassword, passwordHash);

    if (!validUsername || !validPassword) {
      recentAttempts.push(now);
      loginAttempts.set(key, recentAttempts);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    loginAttempts.delete(key);
    const token = createSessionToken(username, secret);
    res.set("Set-Cookie", sessionCookie(cookieName, token, secureCookies));
    return res.json({ authenticated: true, username });
  }

  function logout(_req, res) {
    res.set("Set-Cookie", sessionCookie(cookieName, "", secureCookies, 0));
    return res.json({ authenticated: false });
  }

  return { login, logout, requireAuth, session };
}

function createAuthFromEnvironment() {
  return createAuth({
    username: process.env.AUTH_USERNAME,
    passwordHash: process.env.AUTH_PASSWORD_HASH,
    secret: process.env.AUTH_SECRET,
    secureCookies: process.env.NODE_ENV === "production",
  });
}

module.exports = {
  createAuth,
  createAuthFromEnvironment,
  hashPassword,
  verifyPassword,
};
