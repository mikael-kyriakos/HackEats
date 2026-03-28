import { randomUUID } from "node:crypto";

import {
  cancelPendingOrder,
  createPendingOrder,
  sendJson,
} from "./lib/hackeats-data.js";

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

  const { productId, quantity, room, customerName, phone } = request.body || {};
  const cleanQuantity = Math.max(1, Number(quantity) || 0);

  if (!productId || !cleanQuantity || !room) {
    return sendJson(response, 400, { error: "Missing order details" });
  }

  const orderId = randomUUID();
  let pendingOrder;

  try {
    pendingOrder = await createPendingOrder({
      orderId,
      productId: String(productId),
      quantity: cleanQuantity,
      room: String(room).trim(),
      customerName: String(customerName || "").trim(),
      phone: String(phone || "").trim(),
    });
  } catch (error) {
    return sendJson(response, 400, { error: error.message || "Unable to reserve stock" });
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${siteUrl}/?checkout=success`);
  params.set("cancel_url", `${siteUrl}/?checkout=cancelled`);
  params.set("submit_type", "pay");
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", String(pendingOrder.quantity));
  params.set("line_items[0][price_data][currency]", "gbp");
  params.set("line_items[0][price_data][unit_amount]", String(pendingOrder.unitAmount));
  params.set("line_items[0][price_data][product_data][name]", pendingOrder.productName);
  params.set(
    "line_items[0][price_data][product_data][description]",
    `Deliver to ${pendingOrder.room}`
  );
  params.set("metadata[orderId]", pendingOrder.orderId);
  params.set("metadata[productId]", pendingOrder.productId);
  params.set("metadata[room]", pendingOrder.room);
  params.set("metadata[customerName]", pendingOrder.customerName || "");
  params.set("metadata[phone]", pendingOrder.phone || "");

  try {
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
      await cancelPendingOrder(pendingOrder.orderId);
      return sendJson(response, stripeResponse.status, {
        error: "Unable to create checkout session",
        details: errorPayload,
      });
    }

    const session = await stripeResponse.json();
    const updateUrl = `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${pendingOrder.orderId}`;
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        checkout_session_id: session.id,
      }),
    });

    if (!updateResponse.ok) {
      await cancelPendingOrder(pendingOrder.orderId);
      return sendJson(response, 500, {
        error: "Checkout started but order could not be recorded safely",
      });
    }

    return sendJson(response, 200, { url: session.url, id: session.id });
  } catch (error) {
    await cancelPendingOrder(pendingOrder.orderId);
    return sendJson(response, 500, {
      error: "Checkout could not be started. Reserved stock has been released.",
    });
  }
}
