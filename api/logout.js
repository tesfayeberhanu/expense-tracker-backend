import {
  clearSessionCookie,
  deleteSession,
  hasValidSession,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  if (!requireSameOrigin(request, response)) return;
  if (!(await hasValidSession(request))) {
    return sendJson(response, 401, { error: "Authentication required." });
  }

  await deleteSession(request);
  response.setHeader("Set-Cookie", clearSessionCookie());
  return sendJson(response, 200, { authenticated: false });
}
