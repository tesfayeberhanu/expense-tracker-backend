import {
  getValidSession,
  requireApiRequest,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { changeUserPassword } from "./_users.js";

export default async function handler(request, response) {
  if (!requireApiRequest(request, response)) return;
  if (!requireSameOrigin(request, response)) return;

  if (request.method !== "PUT") {
    response.setHeader("Allow", "PUT");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const session = await getValidSession(request);
  if (!session) {
    return sendJson(response, 401, { error: "Authentication required." });
  }

  try {
    const { currentPassword, newPassword } = request.body ?? {};
    if (!(await changeUserPassword(session.user, currentPassword, newPassword))) {
      return sendJson(response, 400, { error: "Current password is incorrect." });
    }

    return sendJson(response, 200, { updated: true });
  } catch (error) {
    if (error.message.startsWith("Password must contain")) {
      return sendJson(response, 400, { error: error.message });
    }

    console.error("Password API error:", error.message);
    return sendJson(response, 500, { error: "Could not update password." });
  }
}
