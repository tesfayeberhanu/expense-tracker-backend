import {
  requireAnyPermission,
  requirePermission,
  requireApiRequest,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { connectDatabase } from "./_database.js";
import { createTransaction, listTransactions } from "./_transactions.js";

const ALLOWED_METHODS = new Set(["GET", "POST"]);

export default async function handler(request, response) {
  if (!requireApiRequest(request, response)) return;
  if (!requireSameOrigin(request, response)) return;

  if (!ALLOWED_METHODS.has(request.method)) {
    response.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const user =
    request.method === "POST"
      ? await requirePermission(request, response, "transactions:create")
      : await requireAnyPermission(request, response, [
          "transactions:read",
          "reports:view",
        ]);
  if (!user) return;

  try {
    await connectDatabase();
    const transactions =
      request.method === "POST"
        ? await createTransaction(request.body, user)
        : await listTransactions(user);
    return sendJson(response, request.method === "POST" ? 201 : 200, transactions);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      const details =
        error.name === "ValidationError"
          ? Object.values(error.errors).map((item) => item.message)
          : [error.message];
      return sendJson(response, 400, { error: "Validation failed.", details });
    }

    console.error("Transaction API error:", error.message);
    return sendJson(response, 500, { error: "Could not save transactions." });
  }
}
