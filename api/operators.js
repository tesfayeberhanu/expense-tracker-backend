import {
  requireApiRequest,
  requirePermission,
  requireSameOrigin,
  sendJson,
} from "./_auth.js";
import { connectDatabase } from "./_database.js";
import {
  createOperator,
  deactivateOperator,
  listOperators,
  PERMISSIONS,
  updateOperator,
} from "./_users.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

export default async function handler(request, response) {
  if (!requireApiRequest(request, response)) return;
  if (!requireSameOrigin(request, response)) return;

  if (!ALLOWED_METHODS.has(request.method)) {
    response.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const user = await requirePermission(request, response, "operators:manage");
  if (!user) return;

  try {
    await connectDatabase();

    if (request.method === "GET") {
      return sendJson(response, 200, {
        permissions: PERMISSIONS,
        operators: await listOperators(),
      });
    }

    if (request.method === "POST") {
      return sendJson(response, 201, await createOperator(request.body));
    }

    const operatorId = request.params?.id || request.body?.id;
    if (!operatorId) {
      return sendJson(response, 400, { error: "Operator id is required." });
    }

    const operator =
      request.method === "PUT"
        ? await updateOperator(operatorId, request.body)
        : await deactivateOperator(operatorId);

    if (!operator) {
      return sendJson(response, 404, { error: "Operator not found." });
    }

    return sendJson(response, 200, operator);
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError" ||
      error.code === 11000
    ) {
      const details =
        error.name === "ValidationError"
          ? Object.values(error.errors).map((item) => item.message)
          : [error.code === 11000 ? "Username already exists." : error.message];
      return sendJson(response, 400, { error: "Validation failed.", details });
    }

    console.error("Operators API error:", error.message);
    return sendJson(response, 500, { error: "Could not save operator." });
  }
}
