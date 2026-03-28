const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }
}

async function supabaseFetch(path, options = {}) {
  requireSupabaseConfig();

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Supabase request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export async function fetchActiveProducts() {
  const query =
    "/rest/v1/products?select=id,name,description,price_pence,stock,image&active=eq.true&order=name.asc";
  const rows = await supabaseFetch(query, {
    headers: {
      Prefer: "return=representation",
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    pricePence: row.price_pence,
    stock: row.stock,
    image: row.image,
  }));
}

export async function createPendingOrder({
  orderId,
  productId,
  quantity,
  room,
  customerName,
  phone,
}) {
  const result = await supabaseFetch("/rest/v1/rpc/create_pending_order", {
    method: "POST",
    body: JSON.stringify({
      p_order_id: orderId,
      p_product_id: productId,
      p_quantity: quantity,
      p_room: room,
      p_customer_name: customerName,
      p_phone: phone,
    }),
  });

  if (!result || !result.length) {
    throw new Error("Unable to reserve stock");
  }

  const order = result[0];
  return {
    orderId: order.order_id,
    productId,
    productName: order.product_name,
    quantity: order.quantity,
    room,
    customerName,
    phone,
    unitAmount: order.unit_amount,
    totalAmount: order.total_amount,
  };
}

export async function markOrderPaid({ orderId, checkoutSessionId, paymentIntentId }) {
  await supabaseFetch("/rest/v1/rpc/mark_order_paid", {
    method: "POST",
    body: JSON.stringify({
      p_order_id: orderId,
      p_checkout_session_id: checkoutSessionId,
      p_payment_intent_id: paymentIntentId,
    }),
  });
}

export async function cancelPendingOrder(orderId) {
  await supabaseFetch("/rest/v1/rpc/cancel_pending_order", {
    method: "POST",
    body: JSON.stringify({
      p_order_id: orderId,
    }),
  });
}
