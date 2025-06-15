import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

// Constants
const ITEMS_PER_PAGE = 4;
const MAX_VISIBLE_PAGES = 5;

// State
const state = {
  products: [],
  cart: [],
  currentPage: 1,
  soldoutCount: 0,
  isLoading: false,
  error: null,

  // --- Add new fields to state ---
  editedProducts: [],
  convertedImages: {},  // key: filename, value: Blob
  editingProduct: null,
  deleteTarget: null,
};

// DOM Elements
const elements = {
  productsContainer: document.getElementById('products-container'),
  queryExceptionContainer: document.getElementById('query-exception'),
  searchInput: document.getElementById('search-input'),
  showSoldOutCheckbox: document.getElementById('show-soldout'),
  pageNumbersContainer: document.getElementById('page-numbers'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  queryInfoElements: document.querySelectorAll(".query-info"),
  addProductBtn: document.getElementById('add-product-btn'),
  downloadZipBtn: document.getElementById('download-zip-btn'),
  modal: document.getElementById('product-modal'),
  modalClose: document.querySelector('.close'),
  modalTitle: document.getElementById('modal-title'),
  productForm: document.getElementById('product-form'),
  productId: document.getElementById('product-id'),
  productName: document.getElementById('product-name'),
  productSpecies: document.getElementById('product-species'),
  productPrice: document.getElementById('product-price'),
  productAvailable: document.getElementById('product-available'),
  productImage: document.getElementById('product-image'),
  deleteModal: document.getElementById('delete-modal'),
  deleteProductName: document.getElementById('delete-product-name'),
  confirmDelete: document.getElementById('confirm-delete'),
  cancelDelete: document.getElementById('cancel-delete'),
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
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageSrc = product.image 
    ? `data/images/${product.image}` 
    : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=200&w=280&q=80';

    card.innerHTML = `
      <div>
        <img src="${imageSrc}"
            alt="${product.name}" class="product-image">
        ${!product.available ? '<div class="sold-out">Sold Out</div>' : ''}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="product-species">${product.species}</div>
        <p class="product-id">${product.id}</p>
        <div class="product-option">
          <div class="product-price">${utils.formatCurrency(product.price)}</div>
          <div class="product-actions">
            <button class="edit-button"><i class="fa-solid fa-pencil"></i></button>
            <button class="delete-button"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;

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
};

// Initialization
const init = () => {
  elements.showSoldOutCheckbox.checked = false;
  elements.searchInput.value = '';
  setupEventListeners();
  productManager.initialize();
};


function getNextId() {
  const ids = state.products.map(p => parseInt(p.id.slice(2))).sort((a, b) => b - a);
  const next = ids.length ? ids[0] + 1 : 1;
  return `AP${String(next).padStart(5, '0')}`;
}

function convertImageToWebP(file, outputName) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          state.convertedImages[outputName] = blob;
          resolve();
        }, 'image/webp', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const originalCreateProductCard = productView.createProductCard;

productView.createProductCard = function(product) {
  const card = originalCreateProductCard.call(this, product);
  const actions = card.querySelector('.product-actions');
  
  actions.innerHTML = `
    <button class="edit-button" data-id="${product.id}"><i class="fa-solid fa-pencil"></i></button>
    <button class="delete-button" data-id="${product.id}"><i class="fa-solid fa-trash"></i></button>
  `;

  actions.querySelector('.edit-button').addEventListener('click', () => openEditModal(product));
  actions.querySelector('.delete-button').addEventListener('click', () => openDeleteModal(product));
  
  return card;
}

// --- Modal Logic ---

function openAddModal() {
  elements.modalTitle.textContent = 'Add Product';
  state.editingProduct = null;
  elements.productForm.reset();
  elements.productId.value = getNextId();
  elements.productAvailable.checked = true;
  elements.modal.style.display = 'block';
}

function openEditModal(product) {
  elements.modalTitle.textContent = 'Edit Product';
  state.editingProduct = product;
  elements.productId.value = product.id;
  elements.productName.value = product.name;
  elements.productSpecies.value = product.species;
  elements.productPrice.value = product.price;
  elements.productAvailable.checked = product.available;
  elements.modal.style.display = 'block';
}

function openDeleteModal(product) {
  state.deleteTarget = product;
  elements.deleteProductName.textContent = product.name;
  elements.deleteModal.style.display = 'block';
}

function closeModal() {
  elements.modal.style.display = 'none';
  elements.deleteModal.style.display = 'none';
}

// --- Form submission handler ---

elements.productForm.onsubmit = async function(e) {
  e.preventDefault();
  
  const id = elements.productId.value;
  const name = elements.productName.value.trim();
  const species = elements.productSpecies.value.trim();
  const price = parseFloat(elements.productPrice.value);
  const available = elements.productAvailable.checked;
  const file = elements.productImage.files[0];
  const createdAt = state.editingProduct ? state.editingProduct.created_at : new Date().toISOString();

  let image = state.editingProduct?.image || "";

  if (file) {
    const safeName = name.toLowerCase().replace(/\s+/g, '_');
    const imageFileName = `${id}_${safeName}.webp`;
    await convertImageToWebP(file, imageFileName);
    image = imageFileName;
  }

  if (state.editingProduct) {
    Object.assign(state.editingProduct, { name, species, price, available, image });
  } else {
    const newProduct = { id, name, species, price, available, image, created_at: createdAt };
    state.products.unshift(newProduct);  // prepend newest first
  }

  state.editedProducts.push(id);
  productView.updateView();
  closeModal();
}


// --- Delete handler ---

elements.confirmDelete.onclick = function() {
  state.products = state.products.filter(p => p.id !== state.deleteTarget.id);
  state.editedProducts.push(state.deleteTarget.id);
  productView.updateView();
  closeModal();
}

// --- Modal close events ---
elements.modalClose.onclick = closeModal;
elements.cancelDelete.onclick = closeModal;

// --- Download ZIP logic ---

elements.downloadZipBtn.onclick = async function() {
  const zip = new JSZip();
  zip.file('products.json', JSON.stringify(state.products, null, 2));
  const imgFolder = zip.folder('images');

  for (const [filename, blob] of Object.entries(state.convertedImages)) {
    imgFolder.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.zip';
  a.click();
}

// --- Event Listener extension ---

const extendEventListeners = () => {
  elements.addProductBtn.addEventListener('click', openAddModal);
};

const extendedInit = () => {
  init();  // your existing init still works
  extendEventListeners();
};

document.addEventListener('DOMContentLoaded', extendedInit);