import { fetchActiveProducts, sendJson } from "./lib/hackeats-data.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  try {
    const products = await fetchActiveProducts();
    return sendJson(response, 200, { products });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Products could not be loaded",
    });
  }
}
