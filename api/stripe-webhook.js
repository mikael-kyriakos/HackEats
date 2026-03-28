import { createHmac, timingSafeEqual } from "node:crypto";

import { cancelPendingOrder, markOrderPaid, sendJson } from "./lib/hackeats-data.js";

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, signatureHeader, endpointSecret) {
  if (!signatureHeader || !endpointSecret) {
    throw new Error("Missing Stripe signature information");
  }

  const elements = signatureHeader.split(",").reduce((accumulator, item) => {
    const [key, value] = item.split("=");
    if (key && value) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});

  const timestamp = elements.t;
  const signature = elements.v1;

  if (!timestamp || !signature) {
    throw new Error("Stripe signature is incomplete");
  }

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expectedSignature = createHmac("sha256", endpointSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const isMatch = timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(signature, "hex")
  );

  if (!isMatch) {
    throw new Error("Stripe signature verification failed");
  }

  return JSON.parse(rawBody.toString("utf8"));
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return sendJson(response, 503, { error: "Stripe webhook secret is not configured" });
  }

  try {
    const rawBody = await readRawBody(request);
    const event = verifyStripeSignature(
      rawBody,
      request.headers["stripe-signature"],
      webhookSecret
    );
    const session = event.data?.object;
    const orderId = session?.metadata?.orderId;

    if (event.type === "checkout.session.completed" && orderId) {
      await markOrderPaid({
        orderId,
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent || null,
      });
    }

    if (event.type === "checkout.session.expired" && orderId) {
      await cancelPendingOrder(orderId);
    }

    return sendJson(response, 200, { received: true });
  } catch (error) {
    return sendJson(response, 400, {
      error: error.message || "Webhook could not be processed",
    });
  }
}
