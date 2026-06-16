import crypto from "node:crypto";
import mongoose from "mongoose";
import { hasCrossOriginClient, isAllowedOrigin } from "./_cors.js";
import { connectDatabase } from "./_database.js";
import { User } from "./_users.js";

const SESSION_COOKIE = "lp_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

const SessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

const Session =
  mongoose.models.Session || mongoose.model("Session", SessionSchema);

const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))]),
  );

const tokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("base64url");

const sessionToken = (request) =>
  parseCookies(request.headers.cookie)[SESSION_COOKIE];

export const createSessionCookie = async (userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  await Session.create({
    tokenHash: tokenHash(token),
    user: userId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
  });
  const sameSite = hasCrossOriginClient() ? "None" : "Strict";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`;
};

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export const getValidSession = async (request) => {
  try {
    const token = sessionToken(request);
    if (!token) return null;

    await connectDatabase();
    const session = await Session.findOne({
      tokenHash: tokenHash(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session || !(await User.exists({ _id: session.user, active: true }))) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
};

export const hasValidSession = async (request) =>
  Boolean(await getValidSession(request));

export const deleteSession = async (request) => {
  const token = sessionToken(request);
  if (!token) return;

  await connectDatabase();
  await Session.deleteOne({ tokenHash: tokenHash(token) });
};

export const sendJson = (response, status, body) => {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
};

export const requireSameOrigin = (request, response) => {
  const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!stateChangingMethods.has(request.method)) return true;

  const origin = request.headers.origin;
  const fetchSite = request.headers["sec-fetch-site"];
  const originIsTrusted = origin && isAllowedOrigin(origin);
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = forwardedProtocol?.split(",")[0]?.trim() || "https";

  if (
    !originIsTrusted &&
    (fetchSite === "cross-site" ||
      (origin && (!host || origin !== `${protocol}://${host}`)))
  ) {
    sendJson(response, 403, { error: "Cross-site request rejected." });
    return false;
  }

  return true;
};

export const requireApiRequest = (request, response) => {
  const fetchMode = request.headers["sec-fetch-mode"];
  const fetchDestination = request.headers["sec-fetch-dest"];
  const accept = request.headers.accept || "";

  if (
    fetchMode === "navigate" ||
    fetchDestination === "document" ||
    accept.includes("text/html")
  ) {
    sendJson(response, 404, { error: "API endpoint not found." });
    return false;
  }

  return true;
};
