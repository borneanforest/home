// Constants
const ITEMS_PER_PAGE = 4;
const MAX_VISIBLE_PAGES = 5;
const DEFAULT_PHONE_NUMBER = "6281352534448";

// State
const state = {
  products: [],
  cart: [],
  currentPage: 1,
  soldoutCount: 0,
  isLoading: false,
  error: null
};

// DOM Elements
const elements = {
  productsContainer: document.getElementById('products-container'),
  queryExceptionContainer: document.getElementById('query-exception'),
  cartContainer: document.getElementById('cart-container'),
  cartCount: document.getElementById('cart-count'),
  totalAmount: document.getElementById('total-amount'),
  whatsappBtn: document.getElementById('whatsapp-btn'),
  searchInput: document.getElementById('search-input'),
  showSoldOutCheckbox: document.getElementById('show-soldout'),
  pageNumbersContainer: document.getElementById('page-numbers'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  queryInfoElements: document.querySelectorAll(".query-info")
};

// Utilities
const utils = {
  debounce: (func, timeout = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  },

  formatCurrency: (amount, currency = 'USD', locale = 'en') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  }
};

// API Service
const productService = {
  async fetchProducts() {
    try {
      state.isLoading = true;
      const response = await fetch("data/products.json");
      if (!response.ok) throw new Error('Failed to load products');
      return await response.json();
    } catch (error) {
      console.error('Product Service Error:', error);
      throw error;
    } finally {
      state.isLoading = false;
    }
  }
};

// Product Logic
const productManager = {
  async initialize() {
    try {
      const products = await productService.fetchProducts();
      state.products = products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      state.soldoutCount = products.filter(p => !p.available).length;
      productView.updateView();
    } catch {
      productView.showError('Failed to load products', 'Please refresh or try again later');
    }
  },

  getFilteredProducts(keyword = '', showSoldOut = false) {
    const lowerKeyword = keyword.toLowerCase();
    return state.products.filter(product => {
      const matches = [product.id, product.name, product.species]
        .some(field => field.toLowerCase().includes(lowerKeyword));
      return matches && (showSoldOut || product.available);
    });
  },

  getPaginatedProducts(products) {
    const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
    return products.slice(start, start + ITEMS_PER_PAGE);
  },

  toggleCartItem(productId, isChecked) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (isChecked) {
      if (!state.cart.some(item => item.id === productId)) {
        state.cart.push({ ...product });
      }
    } else {
      state.cart = state.cart.filter(item => item.id !== productId);
    }
    cartView.updateCart();
  }
};

// Pagination Logic
const paginationManager = {
  getTotalPages(totalItems) {
    return Math.ceil(totalItems / ITEMS_PER_PAGE);
  },

  calculatePageRange(totalPages) {
    if (totalPages <= MAX_VISIBLE_PAGES) {
      return { start: 1, end: totalPages };
    }
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    let start = Math.max(1, state.currentPage - half);
    let end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    if (end - start < MAX_VISIBLE_PAGES - 1) start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
    return { start, end };
  },

  render(totalItems) {
    const totalPages = this.getTotalPages(totalItems);
    elements.prevBtn.disabled = state.currentPage === 1;
    elements.nextBtn.disabled = state.currentPage === totalPages || totalPages === 0;
    elements.pageNumbersContainer.innerHTML = '';

    const { start, end } = this.calculatePageRange(totalPages);
    for (let i = start; i <= end; i++) {
      const btn = document.createElement('button');
      btn.className = `page-btn ${i === state.currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        state.currentPage = i;
        productView.updateView();
      });
      elements.pageNumbersContainer.appendChild(btn);
    }
  }
};

// Views
const productView = {
  updateView() {
    const keyword = elements.searchInput.value.trim();
    const showSoldOut = elements.showSoldOutCheckbox.checked;
    const filtered = productManager.getFilteredProducts(keyword, showSoldOut);
    const paginated = productManager.getPaginatedProducts(filtered);
    this.renderProducts(paginated);
    paginationManager.render(filtered.length);
    this.updateFilterInfo(filtered.length);
  },

  renderProducts(products) {
    elements.productsContainer.innerHTML = '';
    elements.queryExceptionContainer.style.display = 'none';
    if (products.length === 0) return this.showNoProducts();

    const fragment = document.createDocumentFragment();
    products.forEach(product => {
      fragment.appendChild(this.createProductCard(product));
    });
    elements.productsContainer.appendChild(fragment);
  },

  createProductCard(product) {
    const isInCart = state.cart.some(item => item.id === product.id);
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageSrc = product.image 
    ? `data/images/${product.image}` 
    : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=200&w=280&q=80';

    card.innerHTML = `
      <img src="${imageSrc}" 
           alt="${product.name}" class="product-image">
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="product-species">${product.species}</div>
        <p class="product-id">${product.id}</p>
        <div class="product-option">
          <div class="product-price">${utils.formatCurrency(product.price)}</div>
          <div class="product-select">
            <input type="checkbox" id="product-${product.id}" data-id="${product.id}" 
              ${product.available ? '' : 'disabled'} ${isInCart ? 'checked' : ''}>
            <label for="product-${product.id}">${product.available ? 'Add to Cart' : 'Sold Out'}</label>
          </div>
        </div>
      </div>
      ${!product.available ? '<div class="sold-out">Sold Out</div>' : ''}
    `;

    card.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      productManager.toggleCartItem(e.target.dataset.id, e.target.checked);
    });

    return card;
  },

  showError(title, message) {
    elements.queryInfoElements.forEach(el => el.textContent = '');
    elements.queryExceptionContainer.style.display = "flex";
    elements.queryExceptionContainer.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>${title}</h3><p>${message}</p>`;
  },

  showNoProducts() {
    elements.queryInfoElements.forEach(el => el.textContent = '');
    elements.queryExceptionContainer.style.display = "flex";
    elements.queryExceptionContainer.innerHTML = `<i class="fas fa-search"></i><h3>Plant not found</h3><p>Try other keyword or show sold out items.</p>`;
  },

  updateFilterInfo(visibleCount) {
    const hidden = elements.showSoldOutCheckbox.checked ? 0 : state.soldoutCount;
    const message = `Page ${state.currentPage} | Showing ${visibleCount} of ${state.products.length - hidden} item(s)`;
    elements.queryInfoElements.forEach(el => el.textContent = message);
  }
};

const cartView = {
  updateCart() {
    elements.cartCount.textContent = state.cart.length;
    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    elements.totalAmount.textContent = utils.formatCurrency(total);
    elements.whatsappBtn.disabled = state.cart.length === 0;
  },

  generateWhatsAppMessage() {
    const items = state.cart.map((item, index) => `
      *Product ${index + 1}:*
      ID: ${item.id}
      Species: ${item.species}
      Name: ${item.name}
      Price: ${utils.formatCurrency(item.price)}
      Image: https://ahmdfkhri.github.io/aquaflora/data/images/${item.image}`).join('\n\n');

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    return encodeURIComponent(`Hello, I would like to order the following aquatic plants:\n\n${items}\n\n*TOTAL: Rp ${utils.formatCurrency(total)}*\n\nPlease confirm availability. Thank you.`);
  },

  sendWhatsAppMessage() {
    const message = this.generateWhatsAppMessage();
    window.open(`https://wa.me/${DEFAULT_PHONE_NUMBER}?text=${message}`, '_blank');
  }
};

// Event Setup
const setupEventListeners = () => {
  elements.searchInput.addEventListener('input', utils.debounce(() => {
    state.currentPage = 1;
    productView.updateView();
  }));

  elements.showSoldOutCheckbox.addEventListener('change', () => {
    state.currentPage = 1;
    productView.updateView();
  });

  elements.prevBtn.addEventListener('click', () => {
    state.currentPage--;
    productView.updateView();
  });

  elements.nextBtn.addEventListener('click', () => {
    state.currentPage++;
    productView.updateView();
  });

  elements.whatsappBtn.addEventListener('click', () => cartView.sendWhatsAppMessage());
};

// Initialization
const init = () => {
  elements.showSoldOutCheckbox.checked = false;
  elements.searchInput.value = '';
  setupEventListeners();
  productManager.initialize();
  cartView.updateCart();
};

document.addEventListener("DOMContentLoaded", init)