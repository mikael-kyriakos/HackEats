function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  if (!secretKey) {
    return sendJson(response, 503, { error: "Stripe is not configured" });
  }

  const {
    productName,
    quantity,
    room,
    customerName,
    phone,
    unitAmount,
    currency = "gbp",
  } = request.body || {};

  if (!productName || !quantity || !room || !unitAmount) {
    return sendJson(response, 400, { error: "Missing order details" });
  }

  const metadata = {
    room: String(room),
    customerName: String(customerName || ""),
    phone: String(phone || ""),
  };

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${siteUrl}/?checkout=success`);
  params.set("cancel_url", `${siteUrl}/?checkout=cancelled`);
  params.set("submit_type", "pay");
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", String(quantity));
  params.set("line_items[0][price_data][currency]", currency);
  params.set("line_items[0][price_data][unit_amount]", String(unitAmount));
  params.set("line_items[0][price_data][product_data][name]", productName);
  params.set(
    "line_items[0][price_data][product_data][description]",
    `Deliver to ${room}`
  );
  params.set("metadata[room]", metadata.room);
  params.set("metadata[customerName]", metadata.customerName);
  params.set("metadata[phone]", metadata.phone);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeResponse.ok) {
    const errorPayload = await stripeResponse.text();
    return sendJson(response, stripeResponse.status, {
      error: "Unable to create checkout session",
      details: errorPayload,
    });
  }

  const session = await stripeResponse.json();
  return sendJson(response, 200, { url: session.url, id: session.id });
}
