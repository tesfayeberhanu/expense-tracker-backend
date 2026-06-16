import {
  getValidSession,
  requireApiRequest,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { changeUserUsername } from "./_users.js";

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
    const { currentPassword, username } = request.body ?? {};
    const updatedUsername = await changeUserUsername(
      session.user,
      currentPassword,
      username,
    );
    if (!updatedUsername) {
      return sendJson(response, 400, { error: "Current password is incorrect." });
    }

    return sendJson(response, 200, { username: updatedUsername });
  } catch (error) {
    if (error.code === 11000) {
      return sendJson(response, 409, { error: "Username is already in use." });
    }
    if (error.message.startsWith("Username must contain")) {
      return sendJson(response, 400, { error: error.message });
    }

    console.error("Username API error:", error.message);
    return sendJson(response, 500, { error: "Could not update username." });
  }
}
