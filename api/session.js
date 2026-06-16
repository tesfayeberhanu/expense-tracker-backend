import { hasValidSession, sendJson } from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  if (!(await hasValidSession(request))) {
    return sendJson(response, 401, { authenticated: false });
  }

  return sendJson(response, 200, { authenticated: true });
}
