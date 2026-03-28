import { fetchWorkerOrders, sendJson } from "./lib/hackeats-data.js";

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

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  try {
    const orders = await fetchWorkerOrders();
    return sendJson(response, 200, { orders });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Orders could not be loaded",
    });
  }
}
