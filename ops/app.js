const openOrders = document.querySelector("#open-orders");
const fulfilledOrders = document.querySelector("#fulfilled-orders");
const refreshButton = document.querySelector("#refresh-orders");
const loginSection = document.querySelector("#worker-login");
const accessForm = document.querySelector("#access-form");
const accessCodeInput = document.querySelector("#access-code");

function getWorkerCode() {
  return sessionStorage.getItem("hackeats-worker-code") || "";
}

function setWorkerCode(value) {
  if (value) {
    sessionStorage.setItem("hackeats-worker-code", value);
  } else {
    sessionStorage.removeItem("hackeats-worker-code");
  }
}

function formatMoney(pence) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((pence || 0) / 100);
}

function formatTime(value) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderEmpty(container, message) {
  container.innerHTML = `<article class="worker-card"><p class="empty-state">${message}</p></article>`;
}

function buildOrderCard(order, allowFulfill) {
  const article = document.createElement("article");
  article.className = "worker-card";

  const fulfilledByMarkup = order.fulfilledBy
    ? `<p><strong>Completed by:</strong> ${order.fulfilledBy}</p>`
    : "";

  const phoneMarkup = order.phone
    ? `<span>Phone: ${order.phone}</span>`
    : `<span>No phone provided</span>`;

  article.innerHTML = `
    <div class="worker-topline">
      <div>
        <p class="section-label">Order ${order.id.slice(0, 8)}</p>
        <h3>${order.quantity} × ${order.productName}</h3>
      </div>
      <span class="worker-status">${order.status}</span>
    </div>
    <div class="worker-meta">
      <span>Room: ${order.room}</span>
      <span>Total: ${formatMoney(order.totalAmount)}</span>
      <span>Paid: ${formatTime(order.paidAt || order.createdAt)}</span>
      ${phoneMarkup}
    </div>
    <p><strong>Name:</strong> ${order.customerName || "Not provided"}</p>
    ${fulfilledByMarkup}
    <p><strong>Fulfilled:</strong> ${formatTime(order.fulfilledAt)}</p>
  `;

  if (allowFulfill) {
    const actions = document.createElement("form");
    actions.className = "worker-actions";
    actions.innerHTML = `
      <label>
        Runner name
        <input name="fulfilledBy" type="text" placeholder="Optional" />
      </label>
      <button class="primary-button" type="submit">Mark fulfilled</button>
    `;

    actions.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(actions);
      const fulfilledBy = String(formData.get("fulfilledBy") || "").trim();
      const code = getWorkerCode();

      const response = await fetch("/api/fulfill-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(code ? { "x-worker-code": code } : {}),
        },
        body: JSON.stringify({
          orderId: order.id,
          fulfilledBy,
        }),
      });

      if (response.status === 401) {
        setWorkerCode("");
        loginSection.hidden = false;
        renderEmpty(openOrders, "Access code expired. Enter it again to continue.");
        return;
      }

      if (!response.ok) {
        renderEmpty(openOrders, "This order could not be updated. Try refreshing.");
        return;
      }

      await loadOrders();
    });

    article.appendChild(actions);
  }

  return article;
}

async function loadOrders() {
  const code = getWorkerCode();
  const response = await fetch("/api/orders", {
    headers: code ? { "x-worker-code": code } : {},
  });

  if (response.status === 401) {
    loginSection.hidden = false;
    renderEmpty(openOrders, "Enter the worker access code to view the queue.");
    renderEmpty(fulfilledOrders, "Completed orders will appear here.");
    return;
  }

  if (!response.ok) {
    renderEmpty(openOrders, "Orders could not be loaded.");
    renderEmpty(fulfilledOrders, "Orders could not be loaded.");
    return;
  }

  loginSection.hidden = true;
  const data = await response.json();
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const paidOrders = orders.filter((order) => order.status === "paid");
  const doneOrders = orders.filter((order) => order.status === "fulfilled").reverse();

  openOrders.innerHTML = "";
  fulfilledOrders.innerHTML = "";

  if (!paidOrders.length) {
    renderEmpty(openOrders, "No paid orders are waiting right now.");
  } else {
    paidOrders.forEach((order) => {
      openOrders.appendChild(buildOrderCard(order, true));
    });
  }

  if (!doneOrders.length) {
    renderEmpty(fulfilledOrders, "No fulfilled orders yet.");
  } else {
    doneOrders.forEach((order) => {
      fulfilledOrders.appendChild(buildOrderCard(order, false));
    });
  }
}

accessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setWorkerCode(accessCodeInput.value.trim());
  await loadOrders();
});

refreshButton.addEventListener("click", loadOrders);
loadOrders();
