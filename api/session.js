import { authenticatedSessionBody, getAuthenticatedUser, sendJson } from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return sendJson(response, 401, { authenticated: false });
  }

  return sendJson(response, 200, authenticatedSessionBody(user));
}
