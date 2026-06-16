import {
  hasValidSession,
  requireApiRequest,
  sendJson,
} from "./_auth.js";
import { getDashboardConfiguration } from "./_configuration.js";
import { connectDatabase } from "./_database.js";

export default async function handler(request, response) {
  if (!requireApiRequest(request, response)) return;

  if (!(await hasValidSession(request))) {
    return sendJson(response, 401, { error: "Authentication required." });
  }

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    await connectDatabase();
    return sendJson(response, 200, await getDashboardConfiguration());
  } catch (error) {
    console.error("Configuration API error:", error.message);
    return sendJson(response, 500, { error: "Could not load configuration." });
  }
}
