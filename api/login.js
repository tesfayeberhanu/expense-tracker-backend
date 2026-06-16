import {
  createSessionCookie,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { connectDatabase } from "./_database.js";
import { ensureBootstrapUser, verifyUserCredentials } from "./_users.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  if (!requireSameOrigin(request, response)) return;

  try {
    const { username, password } = request.body ?? {};
    await connectDatabase();
    await ensureBootstrapUser();
    const user = await verifyUserCredentials(username, password);
    if (!user) {
      return sendJson(response, 401, { error: "Incorrect username or password." });
    }

    response.setHeader("Set-Cookie", await createSessionCookie(user._id));
    return sendJson(response, 200, { authenticated: true });
  } catch (error) {
    console.error("Login error:", error.message);
    return sendJson(response, 500, { error: "Could not sign in." });
  }
}
