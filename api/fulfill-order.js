import { fulfillOrder, sendJson } from "./lib/hackeats-data.js";

function isAuthorized(request) {
  const configuredCode = process.env.WORKER_ACCESS_CODE;
  if (!configuredCode) {
    return true;
  }

  return request.headers["x-worker-code"] === configuredCode;
}

export default async function handler(request, response) {
  if (!isAuthorized(request)) {
    return sendJson(response, 401, { error: "Worker access code is incorrect" });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const { orderId, fulfilledBy } = request.body || {};
  if (!orderId) {
    return sendJson(response, 400, { error: "Order ID is required" });
  }

  try {
    await fulfillOrder({
      orderId: String(orderId),
      fulfilledBy: String(fulfilledBy || "").trim(),
    });
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Order could not be fulfilled",
    });
  }
}
