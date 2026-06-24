import {
  requireAnyPermission,
  requirePermission,
  requireApiRequest,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { connectDatabase } from "./_database.js";
import {
  createTransaction,
  listTransactions,
  updateTransaction,
} from "./_transactions.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT"]);

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
      : request.method === "PUT"
        ? await requirePermission(request, response, "transactions:update")
      : await requireAnyPermission(request, response, [
          "transactions:read",
          "reports:view",
        ]);
  if (!user) return;

  try {
    await connectDatabase();
    if (request.method === "POST") {
      return sendJson(
        response,
        201,
        await createTransaction(request.body, user),
      );
    }

    if (request.method === "PUT") {
      const transactionId = request.params?.id || request.body?.id;
      if (!transactionId) {
        return sendJson(response, 400, { error: "Transaction id is required." });
      }

      const transaction = await updateTransaction(
        transactionId,
        request.body,
        user,
      );
      if (!transaction) {
        return sendJson(response, 404, { error: "Transaction not found." });
      }

      return sendJson(response, 200, transaction);
    }

    return sendJson(response, 200, await listTransactions(user));
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
