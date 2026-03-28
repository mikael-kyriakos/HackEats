const state = {
  products: [],
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

function getSelectedProduct() {
  return state.products.find((entry) => entry.id === state.selectedProductId) || null;
}

function updateStatusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");

  if (checkoutState === "success") {
    checkoutMessage.textContent =
      "Payment completed. Your order is now in the queue for delivery.";
  } else if (checkoutState === "cancelled") {
    checkoutMessage.textContent =
      "Payment was cancelled. Your reserved stock will be released shortly if you do not retry.";
  }
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

  if (filteredProducts.length === 0) {
    productGrid.innerHTML =
      '<article class="glass-card product-card"><p class="product-description">No products matched your search.</p></article>';
  }

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
    "You will be redirected to Stripe to complete payment. Stock is reserved when checkout starts.";

  updateOrderTotal();
  modal.showModal();
}

function closeModal() {
  purchaseForm.reset();
  state.selectedProductId = null;
  modal.close();
}

function updateOrderTotal() {
  const product = getSelectedProduct();
  if (!product) {
    orderTotal.textContent = formatCurrency(0);
    return;
  }

  const quantity = Math.max(1, Number(quantityInput.value) || 1);
  orderTotal.textContent = formatCurrency(product.pricePence * quantity);
}

async function loadProducts() {
  productGrid.innerHTML =
    '<article class="glass-card product-card"><p class="product-description">Loading products...</p></article>';

  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error("Unable to load products");
    }

    const data = await response.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    renderProducts(searchInput.value);
    updateStatusFromUrl();
  } catch (error) {
    productGrid.innerHTML =
      '<article class="glass-card product-card"><p class="product-description">Products could not be loaded. Check the Supabase setup in Vercel and try again.</p></article>';
    availableCount.textContent = "0";
  }
}

async function refreshProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    renderProducts(searchInput.value);
  } catch (error) {
    // Keep the current UI if a background refresh fails.
  }
}

async function handleCheckout(event) {
  event.preventDefault();
  const product = getSelectedProduct();
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
    quantity,
    room: String(formData.get("room") || "").trim(),
    customerName: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
  };

  if (!payload.room) {
    checkoutMessage.textContent = "Please enter the room or location for delivery.";
    return;
  }

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

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Checkout unavailable");
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error("Missing checkout URL");
  } catch (error) {
    checkoutMessage.textContent =
      error.message || "Checkout could not be started. Please try again.";
    submitOrder.disabled = false;
    submitOrder.textContent = "Pay & order";
    await refreshProducts();
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

loadProducts();
