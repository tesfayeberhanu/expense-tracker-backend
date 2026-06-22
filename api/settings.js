import {
  requireApiRequest,
  requirePermission,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { connectDatabase } from "./_database.js";
import {
  getDashboardSettings,
  updateDashboardSettings,
} from "./_settings.js";

const ALLOWED_METHODS = new Set(["GET", "PUT"]);

export default async function handler(request, response) {
  if (!requireApiRequest(request, response)) return;
  if (!requireSameOrigin(request, response)) return;

  if (!ALLOWED_METHODS.has(request.method)) {
    response.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const user = await requirePermission(
    request,
    response,
    request.method === "PUT" ? "settings:update" : "settings:read",
  );
  if (!user) return;

  try {
    await connectDatabase();
    const settings =
      request.method === "PUT"
        ? await updateDashboardSettings(request.body)
        : await getDashboardSettings();
    return sendJson(response, 200, settings);
  } catch (error) {
    if (error.name === "ValidationError") {
      const details = Object.values(error.errors).map((item) => item.message);
      return sendJson(response, 400, {
        error: "Validation failed.",
        details,
      });
    }

    console.error("Settings API error:", error.message);
    return sendJson(response, 500, { error: "Could not save settings." });
  }
}
