const products = [
  {
    id: "volt-energy",
    name: "Volt Energy",
    description: "Citrus energy drink for teams pushing through the midnight sprint.",
    pricePence: 280,
    stock: 14,
    image: "./assets/volt-energy.svg",
  },
  {
    id: "pixel-popcorn",
    name: "Pixel Popcorn",
    description: "Sweet and salty popcorn tub that is easy to share around a laptop.",
    pricePence: 220,
    stock: 11,
    image: "./assets/pixel-popcorn.svg",
  },
  {
    id: "debug-chips",
    name: "Debug Chips",
    description: "Sea salt crisps for fast snack refuelling between demos.",
    pricePence: 175,
    stock: 6,
    image: "./assets/debug-chips.svg",
  },
  {
    id: "focus-bar",
    name: "Focus Bar",
    description: "Oat and peanut protein bar for calmer, steadier energy.",
    pricePence: 195,
    stock: 9,
    image: "./assets/focus-bar.svg",
  },
  {
    id: "fruit-boost",
    name: "Fruit Boost Cup",
    description: "Fresh fruit cup when the team wants something lighter.",
    pricePence: 250,
    stock: 4,
    image: "./assets/fruit-boost.svg",
  },
  {
    id: "hydrate-water",
    name: "Hydrate+ Water",
    description: "Cold bottled water to offset the caffeine curve.",
    pricePence: 150,
    stock: 20,
    image: "./assets/hydrate-water.svg",
  },
];

const state = {
  products: structuredClone(products),
  selectedProductId: null,
};

const productGrid = document.querySelector("#product-grid");
const template = document.querySelector("#product-card-template");
const searchInput = document.querySelector("#search-input");
const availableCount = document.querySelector("#available-count");
const modal = document.querySelector("#purchase-modal");
const purchaseForm = document.querySelector("#purchase-form");
const closeModalButton = document.querySelector("#close-modal");
const quantityInput = document.querySelector("#quantity");
const orderTotal = document.querySelector("#order-total");
const submitOrder = document.querySelector("#submit-order");
const modalTitle = document.querySelector("#modal-title");
const modalImage = document.querySelector("#modal-image");
const modalPrice = document.querySelector("#modal-price");
const modalStock = document.querySelector("#modal-stock");
const productIdInput = document.querySelector("#product-id");
const checkoutMessage = document.querySelector("#checkout-message");

function formatCurrency(pence) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function getStockTone(stock) {
  if (stock <= 0) {
    return { label: "Sold out", className: "out-of-stock" };
  }

  if (stock <= 5) {
    return { label: `${stock} left`, className: "low-stock" };
  }

  return { label: `${stock} in stock`, className: "in-stock" };
}

function renderProducts(filter = "") {
  const query = filter.trim().toLowerCase();
  const filteredProducts = state.products.filter((product) => {
    return (
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
    );
  });

  productGrid.innerHTML = "";

  filteredProducts.forEach((product, index) => {
    const stockTone = getStockTone(product.stock);
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".product-card");
    const image = fragment.querySelector(".product-image");
    const badge = fragment.querySelector(".stock-badge");
    const name = fragment.querySelector(".product-name");
    const price = fragment.querySelector(".product-price");
    const description = fragment.querySelector(".product-description");
    const stockText = fragment.querySelector(".stock-text");
    const buyButton = fragment.querySelector(".buy-button");

    card.style.animationDelay = `${index * 80}ms`;
    image.src = product.image;
    image.alt = product.name;
    badge.textContent = stockTone.label;
    badge.classList.add(stockTone.className);
    name.textContent = product.name;
    price.textContent = formatCurrency(product.pricePence);
    description.textContent = product.description;
    stockText.textContent = stockTone.label;
    stockText.classList.add(stockTone.className);
    buyButton.disabled = product.stock <= 0;
    buyButton.textContent = product.stock <= 0 ? "Unavailable" : "Buy";
    buyButton.addEventListener("click", () => openModal(product.id));

    productGrid.appendChild(fragment);
  });

  availableCount.textContent = state.products.filter((product) => product.stock > 0).length;
}

function openModal(productId) {
  const product = state.products.find((entry) => entry.id === productId);
  if (!product || product.stock <= 0) {
    return;
  }

  state.selectedProductId = product.id;
  productIdInput.value = product.id;
  modalTitle.textContent = product.name;
  modalImage.src = product.image;
  modalImage.alt = product.name;
  modalPrice.textContent = `${formatCurrency(product.pricePence)} each`;
  modalStock.textContent = `${product.stock} available right now`;
  quantityInput.max = String(product.stock);
  quantityInput.value = "1";
  checkoutMessage.textContent =
    "Checkout opens in Stripe when configured. Otherwise the order is saved as a demo order.";

  updateOrderTotal();
  modal.showModal();
}

function closeModal() {
  purchaseForm.reset();
  state.selectedProductId = null;
  modal.close();
}

function updateOrderTotal() {
  const product = state.products.find((entry) => entry.id === state.selectedProductId);
  if (!product) {
    orderTotal.textContent = formatCurrency(0);
    return;
  }

  const quantity = Number(quantityInput.value) || 1;
  orderTotal.textContent = formatCurrency(product.pricePence * quantity);
}

async function handleCheckout(event) {
  event.preventDefault();
  const product = state.products.find((entry) => entry.id === state.selectedProductId);
  if (!product) {
    return;
  }

  const quantity = Math.max(1, Number(quantityInput.value) || 1);
  if (quantity > product.stock) {
    checkoutMessage.textContent = `Only ${product.stock} of ${product.name} remain in stock.`;
    return;
  }

  const formData = new FormData(purchaseForm);
  const payload = {
    productId: product.id,
    productName: product.name,
    quantity,
    room: String(formData.get("room") || "").trim(),
    customerName: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    unitAmount: product.pricePence,
    currency: "gbp",
  };

  submitOrder.disabled = true;
  submitOrder.textContent = "Processing...";

  try {
    const response = await fetch("/api/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    }

    throw new Error("Checkout unavailable");
  } catch (error) {
    const orders = JSON.parse(localStorage.getItem("hackeats-demo-orders") || "[]");
    orders.unshift({
      ...payload,
      totalAmount: payload.unitAmount * payload.quantity,
      createdAt: new Date().toISOString(),
      status: "demo-order",
    });
    localStorage.setItem("hackeats-demo-orders", JSON.stringify(orders));

    product.stock -= quantity;
    checkoutMessage.textContent =
      "Stripe is not configured yet, so this has been saved as a demo order in your browser.";
    renderProducts(searchInput.value);

    setTimeout(() => {
      closeModal();
    }, 900);
  } finally {
    submitOrder.disabled = false;
    submitOrder.textContent = "Pay & order";
  }
}

searchInput.addEventListener("input", (event) => {
  renderProducts(event.target.value);
});

quantityInput.addEventListener("input", updateOrderTotal);
closeModalButton.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  const card = modal.querySelector(".modal-card");
  if (!card.contains(event.target)) {
    closeModal();
  }
});
purchaseForm.addEventListener("submit", handleCheckout);

renderProducts();
