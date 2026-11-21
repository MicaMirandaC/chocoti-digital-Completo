/**
 * script.js — ChocoTi-Digital Landing Page
 * Chocolates Para Ti | Sucre, Bolivia
 *
 * Módulos:
 *  1. Lucide Icons Init
 *  2. Header Sticky + Active Nav Links
 *  3. Menú Hamburguesa Responsivo
 *  4. Animaciones de Entrada (IntersectionObserver)
 *  5. Selector de Moneda (BOB / USD)
 *  6. Contador Animado de Estadísticas
 *  7. Filtrado de Productos por Categoría
 *  8. Carrito de Compras
 *  9. Sistema de Toast Notifications
 * 10. Simulador de Rastreo de Pedidos
 * 11. Validación de Formulario Corporativo B2B
 * 12. Validación de Formulario de Contacto
 * 13. Init General
 */

'use strict';

/* ============================================================
   CONSTANTES Y ESTADO GLOBAL
   ============================================================ */

/** Tasa de cambio aproximada BOB → USD */
const BOB_TO_USD = 0.144;

/** Estado global de la aplicación */
const appState = {
  currency: 'BOB',        // moneda activa
  cart: [],               // artículos en el carrito
  products: [],           // catálogo cargado desde el backend
  categories: [],         // categorías de productos
  wishlistIds: new Set(), // IDs de productos en lista de deseos
  selectedCategory: 'all',// filtro de categoría activo
  searchTerm: '',         // texto del buscador normalizado
  statsAnimated: false,   // bandera para animar estadísticas una sola vez
};

/* ============================================================
   1. INICIALIZACIÓN DE LUCIDE ICONS
   ============================================================ */

/**
 * Reemplaza todos los elementos <i data-lucide="..."> con SVGs inline.
 * Se llama al cargar el DOM y cada vez que se inyecte nuevo HTML dinámico.
 */
function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ============================================================
   2. HEADER STICKY + ACTIVE NAV LINKS
   ============================================================ */

function initHeader() {
  const header   = document.getElementById('header');
  const navLinks = document.querySelectorAll('.nav__link');

  // Agrega clase 'scrolled' cuando la página hace scroll
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);

    // Resalta el enlace de nav activo según la sección visible
    highlightActiveNavLink(navLinks);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // ejecuta una vez al inicio para el estado correcto
}

/**
 * Marca el enlace de navegación que corresponde a la sección
 * actualmente visible en el viewport.
 * @param {NodeList} navLinks
 */
function highlightActiveNavLink(navLinks) {
  const sections = document.querySelectorAll('section[id], main[id]');
  let currentId  = '';

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 100 && rect.bottom >= 100) {
      currentId = section.id;
    }
  });

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === `#${currentId}`);
  });
}

/* ============================================================
   3. MENÚ HAMBURGUESA RESPONSIVO
   ============================================================ */

function initHamburger() {
  const hamburger  = document.getElementById('hamburger');
  const nav        = document.getElementById('nav');
  const navOverlay = document.getElementById('navOverlay');

  if (!hamburger || !nav || !navOverlay) return;

  /** Abre / cierra el menú móvil */
  function toggleMenu(forceClose = false) {
    const isOpen = !forceClose && !nav.classList.contains('open');

    nav.classList.toggle('open', isOpen);
    hamburger.classList.toggle('open', isOpen);
    navOverlay.classList.toggle('visible', isOpen);

    hamburger.setAttribute('aria-expanded', String(isOpen));
    nav.setAttribute('aria-hidden', String(!isOpen));

    // Bloquear scroll del body cuando el menú está abierto
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  hamburger.addEventListener('click',  () => toggleMenu());
  navOverlay.addEventListener('click', () => toggleMenu(true));

  // Cierra el menú al hacer clic en cualquier enlace de nav
  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => toggleMenu(true));
  });

  // Cierra el menú con la tecla Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      toggleMenu(true);
    }
  });
}

/* ============================================================
   4. ANIMACIONES DE ENTRADA (IntersectionObserver)
   ============================================================ */

function initScrollAnimations() {
  const elements = document.querySelectorAll('[data-animate]');

  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => {
          entry.target.classList.add('animated');
        }, delay);

        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach(el => observer.observe(el));
}

/* ============================================================
   5. SELECTOR DE MONEDA (BOB / USD)
   ============================================================ */

function initCurrencySelector() {
  const currencyBtns = document.querySelectorAll('.currency-btn');

  currencyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currency = btn.dataset.currency;
      if (currency === appState.currency) return;

      appState.currency = currency;

      // Actualiza estado visual de los botones
      currencyBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.currency === currency);
        b.setAttribute('aria-pressed', String(b.dataset.currency === currency));
      });

      // Actualiza todos los precios visibles en el catálogo
      updateAllPrices();
    });
  });
}

/**
 * Actualiza los precios de todos los productos en la vista
 * según la moneda activa.
 */
function updateAllPrices() {
  const priceEls = document.querySelectorAll('.product-card__price');

  priceEls.forEach(el => {
    const priceBOB = parseFloat(el.dataset.priceBob);
    const priceUSD = parseFloat(el.dataset.priceUsd);

    if (appState.currency === 'USD') {
      el.textContent = `$${priceUSD.toFixed(2)} USD`;
    } else {
      el.textContent = `Bs. ${priceBOB}`;
    }
  });
}

/* ============================================================
   6. CONTADOR ANIMADO DE ESTADÍSTICAS
   ============================================================ */

function initStatsCounter() {
  const statsSection = document.querySelector('.benefits__stats');
  if (!statsSection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !appState.statsAnimated) {
          appState.statsAnimated = true;
          animateCounters();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.5 }
  );

  observer.observe(statsSection);
}

/**
 * Anima todos los contadores [data-count] desde 0 hasta su valor destino.
 */
function animateCounters() {
  const counters = document.querySelectorAll('[data-count]');

  counters.forEach(counter => {
    const target   = parseInt(counter.dataset.count, 10);
    const duration = 1800; // ms
    const steps    = 60;
    const stepTime = duration / steps;
    let current    = 0;

    const increment = Math.ceil(target / steps);

    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      counter.textContent = current.toLocaleString('es-BO');

      if (current >= target) {
        clearInterval(timer);
        counter.textContent = target.toLocaleString('es-BO');
      }
    }, stepTime);
  });
}

/* ============================================================
   7. CATÁLOGO DINÁMICO, BUSCADOR EN VIVO Y LISTA DE DESEOS (FASE 4)
   ============================================================ */

/**
 * Normaliza una cadena quitando acentos y mayúsculas.
 */
function normalizeText(str) {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

/**
 * Retorna emoji característico según categoría o SKU.
 */
function getProductEmoji(categoriaNombre, sku = '') {
  const cat = (categoriaNombre || '').toLowerCase();
  if (cat.includes('bombón') || cat.includes('bombon')) return '🍬';
  if (cat.includes('tableta')) return '🍫';
  if (cat.includes('gragea')) return '🫘';
  if (cat.includes('paleta')) return '🍭';
  if (cat.includes('caja') || cat.includes('artesanal')) return '🎁';
  if (cat.includes('combo')) return '✨';
  return '🍫';
}

/**
 * Carga categorías y productos desde la API REST.
 */
async function initCatalog() {
  const tabsContainer = document.getElementById('catalogTabs');
  const productGrid = document.getElementById('productGrid');

  if (!tabsContainer || !productGrid) return;

  try {
    // 1. Cargar categorías
    if (typeof API !== 'undefined' && API.listarCategorias) {
      appState.categories = await API.listarCategorias();
      renderCategoryTabs(appState.categories);
    }

    // 2. Cargar lista de deseos
    await loadWishlist();

    // 3. Cargar catálogo de productos con stock en tiempo real
    if (typeof API !== 'undefined' && API.listarProductos) {
      const res = await API.listarProductos();
      appState.products = Array.isArray(res) ? res : (res.data || []);
      renderProducts();
    }
  } catch (err) {
    console.error('[CATALOGO] Error al cargar productos:', err);
    if (window.Toast) {
      window.Toast.error('No se pudo conectar con el catálogo de productos.');
    }
  }

  // 4. Inicializar buscador y sugerencias
  initCatalogSearch();

  // 5. Inicializar modal y eventos de lista de deseos
  initWishlist();

  // 6. Inicializar modal de bienvenida
  initWelcomeModal();
}

/**
 * Renderiza los botones de categorías en el catálogo.
 */
function renderCategoryTabs(categories) {
  const container = document.getElementById('catalogTabs');
  if (!container) return;

  let html = `<button class="tab-btn active" role="tab" data-filter="all" aria-selected="true">Todos</button>`;
  categories.forEach(cat => {
    html += `<button class="tab-btn" role="tab" data-filter="${cat.id}" aria-selected="false">${escapeHTML(cat.nombre)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      appState.selectedCategory = btn.dataset.filter;
      renderProducts();
    });
  });
}

/**
 * Renderiza los productos aplicando filtros de categoría y texto de búsqueda.
 */
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('catalogEmptyState');
  if (!grid) return;

  const q = normalizeText(appState.searchTerm);
  const catFilter = appState.selectedCategory;

  const filtered = appState.products.filter(p => {
    // Filtro por categoría
    if (catFilter !== 'all' && String(p.categoria_id) !== String(catFilter)) {
      return false;
    }
    // Filtro por búsqueda (nombre, SKU, categoría, descripción)
    if (q) {
      const matchNombre = normalizeText(p.nombre).includes(q);
      const matchSku = normalizeText(p.sku).includes(q);
      const matchCat = normalizeText(p.categoria_nombre).includes(q);
      const matchDesc = normalizeText(p.descripcion).includes(q);
      if (!matchNombre && !matchSku && !matchCat && !matchDesc) {
        return false;
      }
    }
    return true;
  });

  // Limpiar tarjetas previas excepto el elemento de estado vacío
  const prevCards = grid.querySelectorAll('.product-card');
  prevCards.forEach(c => c.remove());

  if (filtered.length === 0) {
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  filtered.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.id = p.id;
    card.dataset.category = p.categoria_id;

    const emoji = getProductEmoji(p.categoria_nombre, p.sku);
    const isWishlist = appState.wishlistIds.has(p.id);

    // Semáforo de stock
    let stockBadgeHTML = '';
    const estado = p.estado_stock || 'Disponible';
    if (estado === 'Agotado') {
      stockBadgeHTML = `<span class="badge-stock badge-stock--agotado">✕ Agotado</span>`;
    } else if (estado === 'Pocas unidades') {
      stockBadgeHTML = `<span class="badge-stock badge-stock--pocas">⚡ Pocas unidades (${p.stock_disponible || p.stock_minimo || 5})</span>`;
    } else {
      stockBadgeHTML = `<span class="badge-stock badge-stock--disponible">✓ Disponible</span>`;
    }

    const priceBOB = Number(p.precio).toFixed(2);
    const priceUSD = (Number(p.precio) * BOB_TO_USD).toFixed(2);
    const displayPrice = appState.currency === 'USD' ? `$${priceUSD} USD` : `Bs. ${priceBOB}`;
    const isAgotado = estado === 'Agotado';

    card.innerHTML = `
      <div class="product-card__image-wrap">
        <button type="button" class="btn-wishlist-toggle ${isWishlist ? 'active' : ''}" data-id="${p.id}" aria-label="${isWishlist ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
          <i data-lucide="heart" aria-hidden="true"></i>
        </button>
        <div class="product-card__image" aria-hidden="true">${emoji}</div>
      </div>
      <div class="product-card__body">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="product-card__category">${escapeHTML(p.categoria_nombre || '')}</span>
          <span class="product-card__sku">${escapeHTML(p.sku)}</span>
        </div>
        <h3 class="product-card__name">${escapeHTML(p.nombre)}</h3>
        <p class="product-card__desc">${escapeHTML(p.descripcion || 'Elaborado con selecto cacao boliviano.')}</p>
        <div>${stockBadgeHTML}</div>
        <div class="product-card__footer">
          <div class="product-card__pricing">
            <span class="product-card__price" data-price-bob="${priceBOB}" data-price-usd="${priceUSD}">${displayPrice}</span>
          </div>
          <button
            class="btn btn--primary btn--sm add-to-cart"
            data-id="${p.id}"
            data-sku="${escapeHTML(p.sku)}"
            data-name="${escapeHTML(p.nombre)}"
            data-price="${priceBOB}"
            ${isAgotado ? 'disabled aria-disabled="true"' : ''}
            aria-label="${isAgotado ? 'Producto agotado' : 'Añadir ' + escapeHTML(p.nombre) + ' al carrito'}">
            <i data-lucide="shopping-bag" aria-hidden="true"></i> ${isAgotado ? 'Agotado' : 'Añadir'}
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Re-asignar eventos a botones "Añadir al carrito" y corazones
  grid.querySelectorAll('.add-to-cart:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);
      const sku = btn.dataset.sku;
      const id = Number(btn.dataset.id);
      addToCart(name, price, sku, id);
    });
  });

  grid.querySelectorAll('.btn-wishlist-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      toggleWishlist(id);
    });
  });

  initIcons();
}

/**
 * Escapador seguro de caracteres para prevenir XSS.
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Buscador con debounce y sugerencias autocompletables.
 */
function initCatalogSearch() {
  const input = document.getElementById('catalogSearchInput');
  const clearBtn = document.getElementById('catalogSearchClear');
  const suggestionsBox = document.getElementById('searchSuggestionsBox');

  if (!input) return;

  let debounceTimer = null;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (clearBtn) clearBtn.hidden = val.length === 0;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      appState.searchTerm = val;
      renderProducts();

      // Consultar sugerencias al servidor
      if (val.length >= 2 && suggestionsBox && typeof API !== 'undefined') {
        try {
          const sugerencias = await API.obtenerSugerencias(val);
          renderSuggestions(sugerencias, suggestionsBox, input);
        } catch {
          suggestionsBox.hidden = true;
        }
      } else if (suggestionsBox) {
        suggestionsBox.hidden = true;
      }
    }, 250);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      appState.searchTerm = '';
      if (suggestionsBox) suggestionsBox.hidden = true;
      renderProducts();
      input.focus();
    });
  }

  // Cerrar sugerencias si se hace clic afuera
  document.addEventListener('click', (e) => {
    if (suggestionsBox && !suggestionsBox.contains(e.target) && e.target !== input) {
      suggestionsBox.hidden = true;
    }
  });
}

function renderSuggestions(sugerencias, box, input) {
  if (!sugerencias || sugerencias.length === 0) {
    box.hidden = true;
    return;
  }

  let html = '';
  sugerencias.forEach(s => {
    html += `
      <div class="search-suggestion-item" data-name="${escapeHTML(s.nombre)}">
        <div class="suggestion-info">
          <span class="suggestion-title">${escapeHTML(s.nombre)}</span>
          <span class="suggestion-sku">SKU: ${escapeHTML(s.sku)} · ${escapeHTML(s.categoria_nombre || '')}</span>
        </div>
        <span class="suggestion-price">Bs. ${Number(s.precio).toFixed(2)}</span>
      </div>
    `;
  });

  box.innerHTML = html;
  box.hidden = false;

  box.querySelectorAll('.search-suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      input.value = item.dataset.name;
      appState.searchTerm = item.dataset.name;
      box.hidden = true;
      renderProducts();
    });
  });
}

/**
 * Gestión de la Lista de Deseos (Local para visitante, API para autenticado, fusión al login).
 */
async function loadWishlist() {
  if (typeof API !== 'undefined' && API.estaAutenticado()) {
    // Si hay items huérfanos del visitante, fusionar
    const localRaw = localStorage.getItem('chocoti_wishlist');
    if (localRaw) {
      try {
        const localIds = JSON.parse(localRaw);
        if (Array.isArray(localIds) && localIds.length > 0) {
          await API.sincronizarDeseos(localIds);
          localStorage.removeItem('chocoti_wishlist');
        }
      } catch { /* ignorar */ }
    }

    try {
      const res = await API.listarDeseos();
      const list = res.data || [];
      appState.wishlistIds = new Set(list.map(item => item.producto_id));
    } catch {
      appState.wishlistIds = new Set();
    }
  } else {
    // Modo visitante (navegador)
    try {
      const local = JSON.parse(localStorage.getItem('chocoti_wishlist') || '[]');
      appState.wishlistIds = new Set(local.map(Number));
    } catch {
      appState.wishlistIds = new Set();
    }
  }

  updateWishlistCount();
}

function updateWishlistCount() {
  const badge = document.getElementById('wishlistCount');
  if (badge) {
    badge.textContent = appState.wishlistIds.size;
  }
}

async function toggleWishlist(productId) {
  const pId = Number(productId);
  const exists = appState.wishlistIds.has(pId);

  if (exists) {
    appState.wishlistIds.delete(pId);
    if (typeof API !== 'undefined' && API.estaAutenticado()) {
      try { await API.eliminarDeseo(pId); } catch { /* silencioso */ }
    } else {
      localStorage.setItem('chocoti_wishlist', JSON.stringify([...appState.wishlistIds]));
    }
    showToast('Producto quitado de tu lista de deseos.', 'info', 2500);
  } else {
    appState.wishlistIds.add(pId);
    if (typeof API !== 'undefined' && API.estaAutenticado()) {
      try { await API.agregarDeseo(pId); } catch { /* silencioso */ }
    } else {
      localStorage.setItem('chocoti_wishlist', JSON.stringify([...appState.wishlistIds]));
    }
    showToast('❤️ ¡Producto guardado en tu lista de deseos!', 'success', 2500);
  }

  updateWishlistCount();

  // Actualizar icono en la tarjeta visible
  document.querySelectorAll(`.btn-wishlist-toggle[data-id="${pId}"]`).forEach(btn => {
    btn.classList.toggle('active', !exists);
    btn.setAttribute('aria-label', !exists ? 'Quitar de favoritos' : 'Agregar a favoritos');
  });

  const modal = document.getElementById('wishlistModal');
  if (modal && !modal.hidden) {
    renderWishlistModal();
  }
}

function initWishlist() {
  const btn = document.getElementById('wishlistBtn');
  const modal = document.getElementById('wishlistModal');
  const closeBtn = document.getElementById('wishlistModalClose');

  if (!btn || !modal) return;

  btn.addEventListener('click', () => {
    renderWishlistModal();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  });

  function closeWishlist() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeWishlist);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWishlist();
  });
}

function renderWishlistModal() {
  const container = document.getElementById('wishlistItems');
  if (!container) return;

  const saved = appState.products.filter(p => appState.wishlistIds.has(p.id));

  if (saved.length === 0) {
    container.innerHTML = '<p class="cart-empty">Aún no has guardado favoritos 🍫</p>';
    return;
  }

  let html = '';
  saved.forEach(p => {
    const priceBOB = Number(p.precio).toFixed(2);
    const isAgotado = p.estado_stock === 'Agotado';

    html += `
      <div class="wishlist-item" data-id="${p.id}">
        <div class="wishlist-item__info">
          <div class="wishlist-item__name">${escapeHTML(p.nombre)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-muted)">SKU: ${escapeHTML(p.sku)}</div>
          <div class="wishlist-item__price">Bs. ${priceBOB}</div>
        </div>
        <div class="wishlist-item__actions">
          <button
            class="btn btn--primary btn--sm btn-wishlist-to-cart"
            data-id="${p.id}"
            data-sku="${escapeHTML(p.sku)}"
            data-name="${escapeHTML(p.nombre)}"
            data-price="${priceBOB}"
            ${isAgotado ? 'disabled aria-disabled="true"' : ''}>
            ${isAgotado ? 'Agotado' : 'Mover al Carrito'}
          </button>
          <button class="btn-remove-wishlist" data-id="${p.id}" aria-label="Eliminar de la lista">✕</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-wishlist-to-cart:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      const id = Number(b.dataset.id);
      addToCart(b.dataset.name, parseFloat(b.dataset.price), b.dataset.sku, id);
      toggleWishlist(id);
    });
  });

  container.querySelectorAll('.btn-remove-wishlist').forEach(b => {
    b.addEventListener('click', () => {
      toggleWishlist(Number(b.dataset.id));
    });
  });
}

/**
 * Ventana modal de bienvenida (mostrada una sola vez por visita o recordada).
 */
function initWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  const closeBtn = document.getElementById('welcomeCloseBtn');

  if (!modal) return;

  const yaVisto = sessionStorage.getItem('chocoti_welcome_modal_seen');
  if (!yaVisto) {
    setTimeout(() => {
      modal.hidden = false;
      modal.style.display = 'flex';
      initIcons();
    }, 1200);
  } else {
    modal.hidden = true;
    modal.style.setProperty('display', 'none', 'important');
  }

  function cerrar(entrarTienda = false) {
    modal.hidden = true;
    modal.style.setProperty('display', 'none', 'important');
    document.body.style.overflow = '';
    sessionStorage.setItem('chocoti_welcome_modal_seen', 'true');

    if (entrarTienda) {
      const catalogo = document.getElementById('catalogo');
      if (catalogo) {
        catalogo.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cerrar(true);
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrar(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) cerrar(false);
  });
}


/**
 * Agrega un artículo al carrito o incrementa su cantidad si ya existe.
 * @param {string} name  - Nombre del producto
 * @param {number} price - Precio en BOB
 * @param {string} [sku] - Código SKU
 * @param {number} [id]  - ID del producto
 */
function addToCart(name, price, sku = '', id = null) {
  const existing = appState.cart.find(item => item.name === name || (id && item.id === id));

  if (existing) {
    existing.qty += 1;
  } else {
    appState.cart.push({ id, sku, name, price, qty: 1 });
  }

  updateCartCount();
  showToast(`🍫 "${name}" añadido al carrito`, 'success');

  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    cartCount.classList.remove('bump');
    void cartCount.offsetWidth;
    cartCount.classList.add('bump');
  }
}

/** Actualiza el contador del carrito en el header */
function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    const total = appState.cart.reduce((sum, item) => sum + item.qty, 0);
    cartCount.textContent = total;
  }
}

/* ============================================================
   8. CARRITO DE COMPRAS
   ============================================================ */

function initCart() {
  const cartBtn        = document.getElementById('cartBtn');
  const cartModal      = document.getElementById('cartModal');
  const cartModalClose = document.getElementById('cartModalClose');
  const cartItems      = document.getElementById('cartItems');
  const cartEmpty      = document.getElementById('cartEmpty');
  const cartFooter     = document.getElementById('cartFooter');
  const cartTotal      = document.getElementById('cartTotal');
  const checkoutBtn    = document.getElementById('checkoutBtn');

  if (!cartBtn) return;

  // Botones "Añadir al Carrito" existentes en DOM inicial
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const name  = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);
      addToCart(name, price, btn.dataset.sku, Number(btn.dataset.id));
    });
  });

  // Abrir el modal del carrito
  cartBtn.addEventListener('click', () => {
    renderCartModal();
    cartModal.hidden = false;
    document.body.style.overflow = 'hidden';
    trapFocus(cartModal);
  });

  // Cerrar el modal
  function closeCart() {
    cartModal.hidden = true;
    document.body.style.overflow = '';
    cartBtn.focus();
  }

  cartModalClose.addEventListener('click', closeCart);

  cartModal.addEventListener('click', e => {
    if (e.target === cartModal) closeCart();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !cartModal.hidden) closeCart();
  });

  // Inicio de Checkout Omnicanal (Fase 5A)
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (appState.cart.length === 0) {
        showToast('El carrito está vacío. Agrega productos para continuar.', 'warning');
        return;
      }
      closeCart();
      if (typeof iniciarFlujoCheckout === 'function') {
        iniciarFlujoCheckout();
      }
    });
  }

  /** Renderiza el contenido del modal del carrito */
  function renderCartModal() {
    // Limpiar items previos (excepto el mensaje de vacío)
    const existingItems = cartItems.querySelectorAll('.cart-item');
    existingItems.forEach(el => el.remove());

    if (appState.cart.length === 0) {
      cartEmpty.hidden = false;
      cartFooter.hidden = true;
      return;
    }

    cartEmpty.hidden = true;
    cartFooter.hidden = false;

    let total = 0;

    appState.cart.forEach((item, idx) => {
      const itemTotal = item.price * item.qty;
      total += itemTotal;

      // Emoji basado en el nombre (heurística simple)
      const emoji = getProductEmoji(item.name);

      const cartItemEl = document.createElement('article');
      cartItemEl.className = 'cart-item';
      cartItemEl.setAttribute('aria-label', `${item.name}, cantidad ${item.qty}`);
      cartItemEl.innerHTML = `
        <div class="cart-item__emoji" aria-hidden="true">${emoji}</div>
        <div class="cart-item__info">
          <div class="cart-item__name">${escapeHtml(item.name)}</div>
          <div class="cart-item__price">Bs. ${(item.price * item.qty).toFixed(0)}</div>
        </div>
        <div class="cart-item__qty">
          <button class="qty-btn" data-action="dec" data-idx="${idx}" aria-label="Reducir cantidad de ${item.name}">−</button>
          <span class="qty-value" aria-label="Cantidad">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-idx="${idx}" aria-label="Aumentar cantidad de ${item.name}">+</button>
        </div>
        <button class="cart-item__remove" data-idx="${idx}" aria-label="Eliminar ${item.name} del carrito">
          <i data-lucide="trash-2"></i>
        </button>
      `;

      cartItems.appendChild(cartItemEl);
    });

    // Actualizar total
    cartTotal.textContent = `Bs. ${total.toFixed(0)}`;

    // Re-inicializar iconos en el nuevo HTML
    initIcons();

    // Botones de cantidad y eliminar
    cartItems.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx    = parseInt(btn.dataset.idx, 10);
        const action = btn.dataset.action;
        if (action === 'inc') {
          appState.cart[idx].qty += 1;
        } else {
          appState.cart[idx].qty -= 1;
          if (appState.cart[idx].qty <= 0) {
            appState.cart.splice(idx, 1);
          }
        }
        updateCartCount();
        renderCartModal();
      });
    });

    cartItems.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const removedName = appState.cart[idx].name;
        appState.cart.splice(idx, 1);
        updateCartCount();
        renderCartModal();
        showToast(`🗑️ "${removedName}" eliminado del carrito`);
      });
    });
  }

  /**
   * Retorna un emoji representativo según el nombre del producto.
   * @param {string} name
   * @returns {string}
   */
  function getProductEmoji(name) {
    const lower = name.toLowerCase();
    if (lower.includes('maracuyá') || lower.includes('almendra') || lower.includes('bombón'))  return '🍬';
    if (lower.includes('tableta'))   return '🍫';
    if (lower.includes('canasta'))   return '🎀';
    if (lower.includes('kit') || lower.includes('corporativ')) return '🎁';
    if (lower.includes('valentín') || lower.includes('aniversario')) return '✨';
    return '🍫';
  }

  /**
   * Escapa caracteres HTML para prevenir XSS en contenido dinámico.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Atrapa el foco dentro de un elemento modal para accesibilidad.
   * @param {HTMLElement} modal
   */
  function trapFocus(modal) {
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableEls       = Array.from(modal.querySelectorAll(focusableSelectors));
    if (!focusableEls.length) return;

    const firstEl = focusableEls[0];
    const lastEl  = focusableEls[focusableEls.length - 1];

    firstEl.focus();

    modal.addEventListener('keydown', function handler(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }

      // Limpiar si el modal se cierra
      if (modal.hidden) modal.removeEventListener('keydown', handler);
    });
  }
}

/* ============================================================
   9. SISTEMA DE TOAST NOTIFICATIONS
   ============================================================ */

/**
 * Muestra una notificación toast temporal.
 * @param {string} message      - Texto del mensaje
 * @param {'default'|'success'|'error'} type - Tipo visual
 * @param {number} duration     - Tiempo en ms antes de desaparecer
 */
function showToast(message, type = 'default', duration = 3500) {
  if (typeof window !== 'undefined' && window.Toast) {
    const mapType = type === 'default' ? 'info' : type;
    return window.Toast.show(message, mapType);
  }
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    default: '🍫',
    success: '✅',
    error:   '❌',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icons[type] || icons.default}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remover tras la duración indicada
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ============================================================
   10. SIMULADOR DE RASTREO DE PEDIDOS
   ============================================================ */

   function initTrackingWidget() {
  const trackingForm      = document.getElementById('trackingForm');
  const trackingInput     = document.getElementById('trackingNumber');
  const trackingResult    = document.getElementById('trackingResult');
  const trackResultId     = document.getElementById('trackResultId');
  const trackResultStatus = document.getElementById('trackResultStatus');
  const trackTimeline     = document.getElementById('trackTimeline');

  if (!trackingForm) return;

  function buildTimelineFromOrder(pedido) {
    const estadoRaw = String(pedido.estado_pedido || pedido.estado || 'PENDIENTE_PAGO').toUpperCase();
    const estadoPago = String(pedido.estado_pago || '').toUpperCase();
    const almacenTexto = pedido.almacen_nombre
      ? `${pedido.ciudad_destino || 'Bolivia'} — ${pedido.almacen_nombre}`
      : 'Sucre, Bolivia — Planta Central';

    // Nivel de avance según estado_pedido
    let etapa = 0;
    if (estadoRaw === 'PENDIENTE_PAGO' || estadoRaw === 'EXPIRADO' || estadoRaw === 'CANCELADO') {
      etapa = estadoPago === 'PAGADO' ? 1 : 0;
    } else if (estadoRaw === 'PAGADO') {
      etapa = 1;
    } else if (estadoRaw === 'EN_PREPARACION') {
      etapa = 2;
    } else if (['PREPARADO', 'EMPACADO', 'LISTO_DESPACHO', 'LISTO_RECOJO'].includes(estadoRaw)) {
      etapa = 2;
    } else if (estadoRaw === 'DESPACHADO' || estadoRaw === 'EN_TRANSITO') {
      etapa = 4;
    } else if (estadoRaw === 'ENTREGADO' || estadoRaw === 'FINALIZADO') {
      etapa = 5;
    }

    const esDespacho = pedido.tipo_entrega === 'ENVIO_DOMICILIO';
    const paso3Titulo = esDespacho ? 'Listo para despacho / enviado' : 'Listo para recojo en agencia';
    const paso3Desc   = pedido.guia_envio
      ? `Guía: ${pedido.guia_envio} (${pedido.ciudad_destino || 'Destino'})`
      : pedido.codigo_retiro
      ? `Código de retiro: ${pedido.codigo_retiro}`
      : 'Preparado y verificado en almacén';

    const steps = [
      {
        label: 'Pedido registrado',
        desc: `Estado de pago: ${estadoPago || 'PENDIENTE'} · ${almacenTexto}`,
        done: etapa >= 1,
        active: etapa === 0,
        icon: etapa >= 1 ? '✅' : '🕒',
      },
      {
        label: 'En preparación y empaque',
        desc: estadoRaw === 'EN_PREPARACION'
          ? 'Preparando productos en almacén'
          : etapa >= 2
          ? 'Picking y empaque completados'
          : 'Pendiente de preparación',
        done: etapa > 2 || ['PREPARADO', 'EMPACADO', 'LISTO_DESPACHO', 'LISTO_RECOJO', 'DESPACHADO', 'EN_TRANSITO', 'ENTREGADO', 'FINALIZADO'].includes(estadoRaw),
        active: estadoRaw === 'EN_PREPARACION' || ['PREPARADO', 'EMPACADO', 'LISTO_DESPACHO', 'LISTO_RECOJO'].includes(estadoRaw),
        icon: etapa > 2 ? '✅' : (etapa === 2 ? '⚙️' : '⏳'),
      },
      {
        label: paso3Titulo,
        desc: paso3Desc,
        done: etapa >= 4,
        active: ['LISTO_DESPACHO', 'LISTO_RECOJO'].includes(estadoRaw),
        icon: etapa >= 4 ? '✅' : '📦',
      },
      {
        label: 'Despachado / En tránsito',
        desc: pedido.ciudad_destino ? `Ruta hacia ${pedido.ciudad_destino}` : 'En camino a destino',
        done: etapa >= 5,
        active: etapa === 4,
        icon: etapa >= 5 ? '✅' : (etapa === 4 ? '🚚' : '⏳'),
      },
      {
        label: 'Entregado',
        desc: 'Pedido entregado al destinatario',
        done: etapa >= 5,
        active: false,
        icon: etapa >= 5 ? '✅' : '🎁',
      },
    ];

    const badgeMap = {
      PENDIENTE_PAGO: { text: '🕒 Pendiente de pago', css: 'status--process' },
      PAGADO:         { text: '💳 Pagado', css: 'status--process' },
      EN_PREPARACION: { text: '⚙️ En preparación', css: 'status--process' },
      PREPARADO:      { text: '📦 Preparado', css: 'status--process' },
      EMPACADO:       { text: '📦 Empacado', css: 'status--process' },
      LISTO_DESPACHO: { text: '📦 Listo p/ despacho', css: 'status--process' },
      LISTO_RECOJO:   { text: '🏬 Listo p/ recojo', css: 'status--process' },
      DESPACHADO:     { text: '🚚 Despachado', css: 'status--transit' },
      EN_TRANSITO:    { text: '🚚 En tránsito', css: 'status--transit' },
      ENTREGADO:      { text: '✅ Entregado', css: 'status--delivered' },
      FINALIZADO:     { text: '✅ Finalizado', css: 'status--delivered' },
      CANCELADO:      { text: '❌ Cancelado', css: 'status--process' },
      EXPIRADO:       { text: '⌛ Expirado', css: 'status--process' },
    };

    return {
      steps,
      status: badgeMap[estadoRaw] || { text: estadoRaw, css: 'status--transit' },
    };
  }

  trackingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const guide = trackingInput.value.trim();

    if (!guide) {
      showToast('⚠️ Por favor ingresa un número de pedido o guía válido', 'error');
      trackingInput.focus();
      return;
    }

    const submitBtn = trackingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Buscando...';
    initIcons();

    try {
      const resp = await fetch(`/api/pedidos/codigo/${encodeURIComponent(guide)}`, {
        cache: 'no-store',
      });
      const json = await resp.json();

      if (!resp.ok || !json?.ok || !json?.data) {
        throw new Error(json?.mensaje || `No se encontró el pedido '${guide}'.`);
      }

      const pedido = json.data;
      const data = buildTimelineFromOrder(pedido);

      trackResultId.textContent     = pedido.codigo_pedido || guide.toUpperCase();
      trackResultStatus.textContent = data.status.text;
      trackResultStatus.className   = `tracking__result-status ${data.status.css}`;

      trackTimeline.innerHTML = '';

      data.steps.forEach((step) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'timeline-step';
        stepEl.setAttribute('role', 'listitem');

        const dotClass = step.done
          ? 'timeline-step__dot--done'
          : step.active
          ? 'timeline-step__dot--active'
          : 'timeline-step__dot--pending';

        stepEl.innerHTML = `
          <div class="timeline-step__dot ${dotClass}" aria-hidden="true">${step.icon}</div>
          <div class="timeline-step__content">
            <h4>${escapeHTML(step.label)}</h4>
            <p>${escapeHTML(step.desc)}</p>
          </div>
        `;
        trackTimeline.appendChild(stepEl);
      });

      trackingResult.hidden = false;
      trackingResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      trackingResult.hidden = true;
      showToast(`❌ ${err.message || 'Error al consultar el pedido.'}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="search"></i> Rastrear';
      initIcons();
    }
  });
}


/* ============================================================
   11. VALIDACIÓN DEL FORMULARIO CORPORATIVO B2B
   ============================================================ */

function initB2BForm() {
  const form = document.getElementById('b2bForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const isValid = validateB2BForm(form);
    if (!isValid) return;

    // Simular envío exitoso
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Enviando solicitud...';
    initIcons();

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> Enviar Solicitud de Cotización';
      initIcons();

      showToast('🎉 ¡Solicitud enviada! Te contactaremos en menos de 24 horas hábiles.', 'success', 5000);
      form.reset();

      // Limpiar errores visuales
      form.querySelectorAll('.form__input.error').forEach(el => el.classList.remove('error'));
      form.querySelectorAll('.form__error.visible').forEach(el => el.classList.remove('visible'));
    }, 1800);
  });

  // Validación en tiempo real al salir de cada campo
  form.querySelectorAll('.form__input').forEach(input => {
    input.addEventListener('blur', () => validateSingleInput(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) validateSingleInput(input);
    });
  });
}

/**
 * Valida todos los campos del formulario B2B.
 * @param {HTMLFormElement} form
 * @returns {boolean} true si todo es válido
 */
function validateB2BForm(form) {
  let valid = true;

  // Nombre de empresa
  const companyName = form.querySelector('#companyName');
  if (!companyName.value.trim() || companyName.value.trim().length < 3) {
    showFieldError(companyName, 'companyNameError', 'El nombre de la empresa es requerido (mínimo 3 caracteres).');
    valid = false;
  } else {
    clearFieldError(companyName, 'companyNameError');
  }

  // NIT
  const nit = form.querySelector('#nit');
  if (!nit.value.trim() || !/^\d{7,15}$/.test(nit.value.trim())) {
    showFieldError(nit, 'nitError', 'Ingresa un NIT válido (solo números, 7-15 dígitos).');
    valid = false;
  } else {
    clearFieldError(nit, 'nitError');
  }

  // Cantidad
  const quantity = form.querySelector('#quantity');
  if (!quantity.value || parseInt(quantity.value, 10) < 50) {
    showFieldError(quantity, 'quantityError', 'La cantidad mínima para pedidos corporativos es 50 unidades.');
    valid = false;
  } else {
    clearFieldError(quantity, 'quantityError');
  }

  // Fecha de entrega
  const deliveryDate = form.querySelector('#deliveryDate');
  const today        = new Date();
  const selectedDate = deliveryDate.value ? new Date(deliveryDate.value) : null;

  if (!deliveryDate.value || (selectedDate && selectedDate <= today)) {
    showFieldError(deliveryDate, 'deliveryDateError', 'Selecciona una fecha de entrega futura.');
    valid = false;
  } else {
    clearFieldError(deliveryDate, 'deliveryDateError');
  }

  if (!valid) {
    showToast('⚠️ Por favor corrige los errores antes de enviar.', 'error');
  }

  return valid;
}

/**
 * Valida un único campo del formulario y actualiza su estado visual.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} input
 */
function validateSingleInput(input) {
  const errorId = `${input.id}Error`;
  const errorEl = document.getElementById(errorId);
  if (!errorEl) return;

  if (input.required && !input.value.trim()) {
    showFieldError(input, errorId, 'Este campo es requerido.');
  } else if (input.type === 'email' && input.value && !isValidEmail(input.value)) {
    showFieldError(input, errorId, 'Ingresa un correo electrónico válido.');
  } else {
    clearFieldError(input, errorId);
  }
}

/**
 * Muestra un mensaje de error en un campo.
 * @param {HTMLElement} input
 * @param {string} errorId
 * @param {string} message
 */
function showFieldError(input, errorId, message) {
  input.classList.add('error');
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

/**
 * Limpia el error de un campo.
 * @param {HTMLElement} input
 * @param {string} errorId
 */
function clearFieldError(input, errorId) {
  input.classList.remove('error');
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

/* ============================================================
   12. VALIDACIÓN DEL FORMULARIO DE CONTACTO GENERAL
   ============================================================ */

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const isValid = validateContactForm(form);
    if (!isValid) return;

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Enviando mensaje...';
    initIcons();

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> Enviar Mensaje';
      initIcons();

      showToast('✉️ ¡Mensaje enviado! Te responderemos en menos de 2 horas hábiles.', 'success', 5000);
      form.reset();

      form.querySelectorAll('.form__input.error').forEach(el => el.classList.remove('error'));
      form.querySelectorAll('.form__error.visible').forEach(el => el.classList.remove('visible'));
    }, 1500);
  });

  // Validación en tiempo real
  form.querySelectorAll('.form__input').forEach(input => {
    input.addEventListener('blur', () => validateSingleInput(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) validateSingleInput(input);
    });
  });
}

/**
 * Valida todos los campos del formulario de contacto.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateContactForm(form) {
  let valid = true;

  // Nombre
  const name = form.querySelector('#contactName');
  if (!name.value.trim() || name.value.trim().length < 2) {
    showFieldError(name, 'contactNameError', 'Por favor ingresa tu nombre completo.');
    valid = false;
  } else {
    clearFieldError(name, 'contactNameError');
  }

  // Email
  const email = form.querySelector('#contactEmail');
  if (!email.value.trim() || !isValidEmail(email.value)) {
    showFieldError(email, 'contactEmailError', 'Ingresa un correo electrónico válido.');
    valid = false;
  } else {
    clearFieldError(email, 'contactEmailError');
  }

  // Mensaje
  const message = form.querySelector('#contactMessage');
  if (!message.value.trim() || message.value.trim().length < 10) {
    showFieldError(message, 'contactMessageError', 'El mensaje debe tener al menos 10 caracteres.');
    valid = false;
  } else {
    clearFieldError(message, 'contactMessageError');
  }

  if (!valid) {
    showToast('⚠️ Por favor revisa los campos marcados en rojo.', 'error');
  }

  return valid;
}

/**
 * Valida el formato de un correo electrónico.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ============================================================
   12B. CHECKOUT OMNICANAL, QR Y PASARELAS DE PAGO (FASE 5A)
   ============================================================ */

let checkoutState = {
  activeOrder: null,
  activePaymentData: null,
  pollingTimer: null,
  countdownTimer: null,
  shippingCost: 0,
  discount: 0,
  couponApplied: null,
};

function iniciarFlujoCheckout() {
  if (appState.cart.length === 0) {
    showToast('Tu carrito está vacío. Agrega productos para pagar.', 'warning');
    return;
  }

  const sesion = (typeof API !== 'undefined') ? API.obtenerSesion() : null;

  if (!sesion) {
    // Preguntar si ya tiene cuenta
    const chkAuthModal = document.getElementById('checkoutAuthModal');
    if (chkAuthModal) {
      chkAuthModal.hidden = false;
      document.body.style.overflow = 'hidden';
      initIcons();
    } else {
      abrirFormularioCheckout(null);
    }
  } else {
    abrirFormularioCheckout(sesion.usuario);
  }
}

async function abrirFormularioCheckout(usuario = null) {
  const checkoutModal = document.getElementById('checkoutModal');
  if (!checkoutModal) return;

  const chkAuthModal = document.getElementById('checkoutAuthModal');
  if (chkAuthModal) chkAuthModal.hidden = true;

  // Autocompletar datos si hay usuario
  if (usuario) {
    const inputNombre = document.getElementById('chkNombre');
    const inputEmail = document.getElementById('chkEmail');
    const inputCi = document.getElementById('chkCiNit');
    const inputTel = document.getElementById('chkTelefono');
    const inputRazon = document.getElementById('chkRazonSocial');

    if (inputNombre && !inputNombre.value) inputNombre.value = usuario.nombre_completo || '';
    if (inputEmail && !inputEmail.value) inputEmail.value = usuario.email || '';
    if (inputCi && !inputCi.value) inputCi.value = usuario.ci_nit || '';
    if (inputTel && !inputTel.value) inputTel.value = usuario.telefono || '';
    if (inputRazon && !inputRazon.value) inputRazon.value = usuario.razon_social || '';
  }

  // Cargar agencias propias
  await cargarAgenciasPropiasCheckout();

  // Calcular resumen inicial
  recalcularResumenCheckout();

  checkoutModal.hidden = false;
  document.body.style.overflow = 'hidden';
  initIcons();
}

async function cargarAgenciasPropiasCheckout() {
  const selectAgencias = document.getElementById('chkPuntoRecojo');
  if (!selectAgencias) return;

  try {
    const res = await API.obtenerAgenciasPropias();
    if (res && res.data && res.data.length > 0) {
      selectAgencias.innerHTML = res.data.map(ag => `
        <option value="${ag.id}">${escapeHtml(ag.ciudad)}: ${escapeHtml(ag.nombre)} (${escapeHtml(ag.direccion)})</option>
      `).join('');
    } else {
      selectAgencias.innerHTML = '<option value="">No hay agencias disponibles</option>';
    }
  } catch (err) {
    console.warn('Error al cargar agencias:', err);
    selectAgencias.innerHTML = '<option value="1">Agencia Principal Sucre (Calle Arenales Nº 7)</option>';
  }
}

function recalcularResumenCheckout() {
  const chkSubtotalEl = document.getElementById('chkSubtotal');
  const chkEnvioEl    = document.getElementById('chkEnvio');
  const chkDescuentoEl= document.getElementById('chkDescuento');
  const rowDescuento  = document.getElementById('rowChkDescuento');
  const chkTotalEl    = document.getElementById('chkTotal');
  const chkItemsCount = document.getElementById('chkItemsCount');

  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalItems = appState.cart.reduce((sum, item) => sum + item.qty, 0);

  if (chkItemsCount) chkItemsCount.textContent = totalItems;
  if (chkSubtotalEl) chkSubtotalEl.textContent = `Bs. ${subtotal.toFixed(2)}`;

  // Tipo de entrega
  const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value || 'ENVIO_DOMICILIO';
  let costoEnvio = 0;

  if (tipoEntrega === 'RECOJO_AGENCIA') {
    costoEnvio = 0;
  } else {
    const ciudad = document.getElementById('chkCiudad')?.value || 'Sucre';
    if (ciudad.toLowerCase() === 'sucre') {
      costoEnvio = 0;
    } else {
      costoEnvio = 25;
    }
  }

  checkoutState.shippingCost = costoEnvio;
  if (chkEnvioEl) {
    chkEnvioEl.textContent = costoEnvio === 0 ? 'Gratis (Bs. 0.00)' : `Bs. ${costoEnvio.toFixed(2)}`;
  }

  // Descuento
  let descuento = 0;
  if (checkoutState.couponApplied === 'CHOCOTI10') {
    descuento = subtotal * 0.10;
    if (rowDescuento) rowDescuento.hidden = false;
    if (chkDescuentoEl) chkDescuentoEl.textContent = `-Bs. ${descuento.toFixed(2)}`;
  } else {
    if (rowDescuento) rowDescuento.hidden = true;
  }
  checkoutState.discount = descuento;

  const total = Math.max(0, subtotal + costoEnvio - descuento);
  if (chkTotalEl) chkTotalEl.textContent = `Bs. ${total.toFixed(2)}`;
}

function initCheckout() {
  const checkoutModal       = document.getElementById('checkoutModal');
  const checkoutModalClose  = document.getElementById('checkoutModalClose');
  const checkoutAuthModal   = document.getElementById('checkoutAuthModal');
  const checkoutAuthClose   = document.getElementById('checkoutAuthClose');
  const btnChkLogin         = document.getElementById('btnChkLogin');
  const btnChkRegister      = document.getElementById('btnChkRegister');
  const btnChkGuest         = document.getElementById('btnChkGuest');
  const checkoutForm        = document.getElementById('checkoutForm');
  const checkoutAlert       = document.getElementById('checkoutAlert');
  const checkoutAlertText   = document.getElementById('checkoutAlertText');

  const lblDeliveryDomicilio= document.getElementById('lblDeliveryDomicilio');
  const lblDeliveryAgencia  = document.getElementById('lblDeliveryAgencia');
  const paneDeliveryDomicilio = document.getElementById('paneDeliveryDomicilio');
  const paneDeliveryAgencia   = document.getElementById('paneDeliveryAgencia');
  const chkCiudad           = document.getElementById('chkCiudad');

  const lblPayQR            = document.getElementById('lblPayQR');
  const lblPayTransferencia = document.getElementById('lblPayTransferencia');
  const lblPayEfectivo      = document.getElementById('lblPayEfectivo');
  const lblPayPaypal        = document.getElementById('lblPayPaypal');

  const btnAplicarCupon     = document.getElementById('btnAplicarCupon');
  const chkCupon            = document.getElementById('chkCupon');
  const cuponMsg            = document.getElementById('cuponMsg');

  // Pasarela
  const paymentGatewayModal = document.getElementById('paymentGatewayModal');
  const payGatewayClose     = document.getElementById('payGatewayClose');
  const btnSimularPagoQR    = document.getElementById('btnSimularPagoQR');
  const btnSimularRechazoQR = document.getElementById('btnSimularRechazoQR');
  const formUploadComp      = document.getElementById('formUploadComprobante');
  const compArchivo         = document.getElementById('compArchivo');
  const compFilePreview     = document.getElementById('compFilePreview');
  const btnEntendidoEfectivo= document.getElementById('btnEntendidoEfectivo');

  // Modal Éxito
  const orderSuccessModal   = document.getElementById('orderSuccessModal');
  const btnImprimirNota     = document.getElementById('btnImprimirNotaVenta');
  const btnCerrarTodoExito  = document.getElementById('btnCerrarTodoExito');

  if (!checkoutModal) return;

  // Cerrar modales
  checkoutModalClose?.addEventListener('click', () => {
    checkoutModal.hidden = true;
    document.body.style.overflow = '';
  });

  checkoutAuthClose?.addEventListener('click', () => {
    checkoutAuthModal.hidden = true;
    document.body.style.overflow = '';
  });

  payGatewayClose?.addEventListener('click', () => {
    if (confirm('¿Deseas cerrar la pasarela de pago? Tu pedido quedará registrado como pendiente mientras dure el tiempo de reserva.')) {
      detenerTimersGateway();
      paymentGatewayModal.hidden = true;
      document.body.style.overflow = '';
    }
  });

  btnCerrarTodoExito?.addEventListener('click', () => {
    orderSuccessModal.hidden = true;
    document.body.style.overflow = '';
  });

  btnImprimirNota?.addEventListener('click', () => {
    window.print();
  });

  // Botones de "¿Ya tienes cuenta?"
  btnChkGuest?.addEventListener('click', () => {
    checkoutAuthModal.hidden = true;
    abrirFormularioCheckout(null);
  });

  btnChkLogin?.addEventListener('click', () => {
    checkoutAuthModal.hidden = true;
    window.__checkoutPending = true;
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      document.getElementById('modalTabLogin')?.click();
      loginModal.hidden = false;
    }
  });

  btnChkRegister?.addEventListener('click', () => {
    checkoutAuthModal.hidden = true;
    window.__checkoutPending = true;
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      document.getElementById('modalTabRegister')?.click();
      loginModal.hidden = false;
    }
  });

  // Toggles de tipo de entrega
  lblDeliveryDomicilio?.addEventListener('click', () => {
    lblDeliveryDomicilio.classList.add('active');
    lblDeliveryAgencia.classList.remove('active');
    paneDeliveryDomicilio.style.display = 'block';
    paneDeliveryAgencia.style.display = 'none';
    const radio = lblDeliveryDomicilio.querySelector('input');
    if (radio) radio.checked = true;
    recalcularResumenCheckout();
  });

  lblDeliveryAgencia?.addEventListener('click', () => {
    lblDeliveryAgencia.classList.add('active');
    lblDeliveryDomicilio.classList.remove('active');
    paneDeliveryDomicilio.style.display = 'none';
    paneDeliveryAgencia.style.display = 'block';
    const radio = lblDeliveryAgencia.querySelector('input');
    if (radio) radio.checked = true;
    recalcularResumenCheckout();
  });

  chkCiudad?.addEventListener('change', recalcularResumenCheckout);

  // Toggles de método de pago
  [lblPayQR, lblPayTransferencia, lblPayEfectivo, lblPayPaypal].forEach(lbl => {
    if (!lbl) return;
    lbl.addEventListener('click', () => {
      [lblPayQR, lblPayTransferencia, lblPayEfectivo, lblPayPaypal].forEach(l => l?.classList.remove('active'));
      lbl.classList.add('active');
      const radio = lbl.querySelector('input');
      if (radio) {
        radio.checked = true;
        if (radio.value === 'EFECTIVO_TIENDA') {
          // Si eligió efectivo, debe ser recojo en agencia
          const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value;
          if (tipoEntrega !== 'RECOJO_AGENCIA') {
            lblDeliveryAgencia?.click();
            showToast('El pago en efectivo en tienda requiere seleccionar Recojo en Agencia.', 'info');
          }
        }
      }
    });
  });

  // Cupones
  btnAplicarCupon?.addEventListener('click', () => {
    const val = chkCupon?.value.trim().toUpperCase();
    if (!val) return;
    if (val === 'CHOCOTI10') {
      checkoutState.couponApplied = 'CHOCOTI10';
      if (cuponMsg) {
        cuponMsg.textContent = '✅ Cupón CHOCOTI10 aplicado: 10% de descuento en tus chocolates.';
        cuponMsg.style.color = 'var(--color-success)';
      }
      showToast('🎉 ¡Cupón CHOCOTI10 aplicado exitosamente!', 'success');
      recalcularResumenCheckout();
    } else {
      if (cuponMsg) {
        cuponMsg.textContent = '❌ Cupón no válido o vencido.';
        cuponMsg.style.color = 'var(--color-error)';
      }
    }
  });

  // Vista previa de archivo en subida de comprobante
  compArchivo?.addEventListener('change', () => {
    const file = compArchivo.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('⚠️ El archivo supera los 2 MB permitidos.', 'error');
        compArchivo.value = '';
        if (compFilePreview) compFilePreview.textContent = '';
        return;
      }
      if (compFilePreview) {
        compFilePreview.textContent = `Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }
    }
  });

  // Simulación bancaria de QR para demo
  btnSimularPagoQR?.addEventListener('click', async () => {
    if (!checkoutState.activePaymentData) return;
    try {
      btnSimularPagoQR.disabled = true;
      btnSimularPagoQR.textContent = 'Procesando banco...';
      await API.notificarBancoDemo({
        referencia: checkoutState.activePaymentData.referencia,
        monto: checkoutState.activeOrder.total,
        estado: 'APROBADO',
        firma: checkoutState.activePaymentData?.firmaDemo,
      });
      showToast('🏦 Notificación bancaria enviada: Pago aprobado.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSimularPagoQR.disabled = false;
      btnSimularPagoQR.textContent = '🏦 Simular Pago Exitoso';
    }
  });

  btnSimularRechazoQR?.addEventListener('click', async () => {
    if (!checkoutState.activePaymentData) return;
    try {
      btnSimularRechazoQR.disabled = true;
      await API.notificarBancoDemo({
        referencia: checkoutState.activePaymentData.referencia,
        monto: checkoutState.activeOrder.total,
        estado: 'RECHAZADO',
        firma: checkoutState.activePaymentData?.firmaDemo,
      });
      showToast('❌ Notificación bancaria enviada: Pago rechazado.', 'warning');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSimularRechazoQR.disabled = false;
    }
  });

  // Envío de comprobante de depósito
  formUploadComp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = compArchivo?.files[0];
    const banco = document.getElementById('compBanco')?.value.trim();
    const nroOp = document.getElementById('compNroOperacion')?.value.trim();
    const fecha = document.getElementById('compFecha')?.value;
    const monto = parseFloat(document.getElementById('compMonto')?.value);

    if (!file || !banco || !nroOp || !fecha || isNaN(monto) || monto <= 0) {
      showToast('Por favor completa todos los campos del comprobante (banco, monto, fecha, nº de operación) y adjunta el archivo.', 'warning');
      return;
    }

    const btnSubmit = document.getElementById('btnEnviarComprobante');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = 'Subiendo comprobante...';
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          await API.subirComprobantePago({
            pedido_id: checkoutState.activeOrder.id,
            archivo_base64: base64Data,
            nombre_archivo: file.name,
            tipo_mime: file.type,
            banco_origen: banco,
            numero_operacion: nroOp,
            fecha_operacion: fecha,
            monto: monto,
          });

          showToast('✅ Comprobante enviado con éxito. En espera de verificación.', 'success', 5000);
          detenerTimersGateway();
          paymentGatewayModal.hidden = true;
          abrirModalExito(checkoutState.activeOrder, 'PENDIENTE DE VERIFICACIÓN');
        } catch (subErr) {
          showToast(subErr?.data?.mensaje || subErr.message, 'error');
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<span>Cargar y Enviar Comprobante</span>';
            initIcons();
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast('Error al leer el archivo.', 'error');
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });

  btnEntendidoEfectivo?.addEventListener('click', () => {
    detenerTimersGateway();
    paymentGatewayModal.hidden = true;
    abrirModalExito(checkoutState.activeOrder, 'PENDIENTE DE PAGO EN TIENDA');
  });

  // Envío del formulario de Checkout
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (checkoutAlert) checkoutAlert.hidden = true;

    const nombre = document.getElementById('chkNombre')?.value.trim();
    const ciNit  = document.getElementById('chkCiNit')?.value.trim();
    const email  = document.getElementById('chkEmail')?.value.trim();
    const tel    = document.getElementById('chkTelefono')?.value.trim();
    const razon  = document.getElementById('chkRazonSocial')?.value.trim();
    const notas  = document.getElementById('chkNotas')?.value.trim();

    if (!nombre || !ciNit || !email || !tel) {
      mostrarErrorCheckout('Por favor llena todos los campos obligatorios del comprador.');
      return;
    }

    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value || 'ENVIO_DOMICILIO';
    let puntoRecojoId = null;
    let ciudadDestino = 'Sucre';
    let direccionEnvio = null;
    let referenciaEnvio = null;

    if (tipoEntrega === 'RECOJO_AGENCIA') {
      puntoRecojoId = document.getElementById('chkPuntoRecojo')?.value;
      if (!puntoRecojoId) {
        mostrarErrorCheckout('Por favor selecciona la agencia propia autorizada para recojo.');
        return;
      }
      const agText = document.getElementById('chkPuntoRecojo')?.selectedOptions[0]?.text || '';
      ciudadDestino = agText.toLowerCase().includes('la paz') ? 'La Paz' : 'Sucre';
    } else {
      ciudadDestino = document.getElementById('chkCiudad')?.value || 'Sucre';
      direccionEnvio = document.getElementById('chkDireccion')?.value.trim();
      referenciaEnvio = document.getElementById('chkReferencia')?.value.trim();
      if (!direccionEnvio) {
        mostrarErrorCheckout('Para envío a domicilio se requiere ingresar la dirección de entrega.');
        return;
      }
    }

    const metodoPago = document.querySelector('input[name="metodo_pago"]:checked')?.value || 'QR';

    const btnConfirmar = document.getElementById('btnConfirmarCheckout');
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = 'Reservando stock y procesando pedido...';
    }

    try {
      const payload = {
        cliente: {
          nombre,
          ci_nit: ciNit,
          email,
          telefono: tel,
          razon_social: razon || null,
        },
        items: appState.cart.map(i => ({ id: i.id, cantidad: i.qty })),
        metodo_pago: metodoPago,
        tipo_entrega: tipoEntrega,
        punto_recojo_id: puntoRecojoId ? Number(puntoRecojoId) : null,
        direccion_envio: direccionEnvio,
        referencia_envio: referenciaEnvio,
        ciudad_destino: ciudadDestino,
        cupon: checkoutState.couponApplied,
        notas,
      };

      const res = await API.crearPedido(payload);

      checkoutState.activeOrder = res.pedido;
      checkoutState.activePaymentData = res.datosPago;

      checkoutModal.hidden = true;
      document.body.style.overflow = '';

      // Abrir modal de pasarela de pago activa
      abrirPasarelaPago(res.pedido, res.datosPago, metodoPago);

    } catch (err) {
      const msg = err?.data?.mensaje || err.message || 'Error al procesar el checkout.';
      mostrarErrorCheckout(msg);
      showToast(msg, 'error');
    } finally {
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i data-lucide="shield-check"></i><span>Confirmar Pedido y Proceder al Pago</span>';
        initIcons();
      }
    }
  });

  function mostrarErrorCheckout(msg) {
    if (checkoutAlert && checkoutAlertText) {
      checkoutAlertText.textContent = msg;
      checkoutAlert.hidden = false;
      checkoutAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function abrirPasarelaPago(pedido, datosPago, metodoPago) {
  const modal = document.getElementById('paymentGatewayModal');
  if (!modal) return;

  const paneQR  = document.getElementById('gatewayPaneQR');
  const paneDep = document.getElementById('gatewayPaneDeposito');
  const paneEfe = document.getElementById('gatewayPaneEfectivo');
  const panePP  = document.getElementById('gatewayPanePaypal');

  paneQR.hidden  = true;
  paneDep.hidden = true;
  paneEfe.hidden = true;
  if (panePP) panePP.hidden = true;

  if (metodoPago === 'QR') {
    paneQR.hidden = false;
    const qrImg   = document.getElementById('qrCodeImg');
    const qrMonto = document.getElementById('qrMontoDisplay');
    const qrRef   = document.getElementById('qrRefDisplay');

    if (qrImg)   qrImg.src = datosPago.qrImagenDataUrl || '';
    if (qrMonto) qrMonto.textContent = `Bs. ${Number(pedido.total).toFixed(2)}`;
    if (qrRef)   qrRef.textContent = datosPago.referencia;

    iniciarCountdownQR(datosPago.minutosReserva || 15);
    iniciarPollingQR(datosPago.referencia);

  } else if (metodoPago === 'TRANSFERENCIA') {
    paneDep.hidden = false;
    const depMonto  = document.getElementById('depMontoDisplay');
    const depRef    = document.getElementById('depRefDisplay');
    const fechaInput = document.getElementById('compFecha');

    if (depMonto)   depMonto.textContent = `Bs. ${Number(pedido.total).toFixed(2)}`;
    if (depRef)     depRef.textContent = datosPago.referencia;
    if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

  } else if (metodoPago === 'EFECTIVO_TIENDA') {
    paneEfe.hidden = false;
    const efeMonto = document.getElementById('efeMontoDisplay');
    const efeNom   = document.getElementById('efeAgenciaNombre');
    const efeDir   = document.getElementById('efeAgenciaDireccion');

    if (efeMonto) efeMonto.textContent = `Bs. ${Number(pedido.total).toFixed(2)}`;
    if (datosPago.agencia) {
      if (efeNom) efeNom.textContent = `${datosPago.agencia.ciudad} - ${datosPago.agencia.nombre}`;
      if (efeDir) efeDir.textContent = datosPago.agencia.direccion;
    }

  } else if (metodoPago === 'PAYPAL' && panePP) {
    // ── Fase 5B: PayPal ──────────────────────────────────────
    panePP.hidden = false;

    // Mostrar montos calculados por el servidor
    const tipoCambio = datosPago.tipoCambio || 6.96;
    const montoUSD   = datosPago.montoUSD   || Number((pedido.total / tipoCambio).toFixed(2));

    const ppMontoBob  = document.getElementById('ppMontoBob');
    const ppMontoUSD  = document.getElementById('ppMontoUSD');
    const ppTipoCambio = document.getElementById('ppTipoCambio');
    const ppEstadoMsg  = document.getElementById('ppEstadoMsg');
    const btnIrAPaypal = document.getElementById('btnIrAPaypal');

    if (ppMontoBob)   ppMontoBob.textContent  = `Bs. ${Number(pedido.total).toFixed(2)}`;
    if (ppMontoUSD)   ppMontoUSD.textContent   = `$ ${montoUSD.toFixed(2)}`;
    if (ppTipoCambio) ppTipoCambio.textContent = tipoCambio.toFixed(2);
    if (ppEstadoMsg)  ppEstadoMsg.style.display = 'none';

    // Guardar datos en el estado del checkout
    checkoutState.paypalOrderId   = datosPago.orderId   || null;
    checkoutState.paypalApprovalUrl = datosPago.approvalUrl || null;

    // Botón "Continuar a PayPal"
    if (btnIrAPaypal) {
      // Limpiar listener anterior para evitar duplicados
      const btnClone = btnIrAPaypal.cloneNode(true);
      btnIrAPaypal.parentNode.replaceChild(btnClone, btnIrAPaypal);

      btnClone.addEventListener('click', async () => {
        btnClone.disabled = true;
        btnClone.textContent = 'Creando orden PayPal...';

        if (ppEstadoMsg) {
          ppEstadoMsg.style.display = 'block';
          ppEstadoMsg.style.background = '#e3f2fd';
          ppEstadoMsg.style.color = '#1565c0';
          ppEstadoMsg.textContent = '⏳ Conectando con PayPal Sandbox...';
        }

        try {
          // Si ya tenemos approvalUrl (creada al crear el pedido), redirigimos directamente
          let approvalUrl = checkoutState.paypalApprovalUrl;

          if (!approvalUrl) {
            // Crear la orden en el servidor si no se creó antes
            const ppRes = await API.paypalCrearOrden({ pedidoId: pedido.id });
            approvalUrl = ppRes.approvalUrl || ppRes.data?.approvalUrl;
            checkoutState.paypalOrderId   = ppRes.orderId;
            checkoutState.paypalApprovalUrl = approvalUrl;

            if (ppMontoUSD && ppRes.montoUSD) {
              ppMontoUSD.textContent = `$ ${Number(ppRes.montoUSD).toFixed(2)}`;
            }
          }

          if (!approvalUrl) {
            throw new Error('No se recibió la URL de aprobación de PayPal.');
          }

          if (ppEstadoMsg) {
            ppEstadoMsg.textContent = '✅ Orden creada. Redirigiendo a PayPal...';
          }

          // Redirigir al portal PayPal Sandbox
          setTimeout(() => { window.location.href = approvalUrl; }, 800);

        } catch (err) {
          btnClone.disabled = false;
          btnClone.textContent = '🔒 Continuar a PayPal';
          if (ppEstadoMsg) {
            ppEstadoMsg.style.background = '#ffebee';
            ppEstadoMsg.style.color = '#c62828';
            ppEstadoMsg.textContent = `❌ Error: ${err?.data?.mensaje || err.message || 'No se pudo conectar con PayPal.'}`;
          }
          showToast('No se pudo crear la orden PayPal. Intenta nuevamente.', 'error');
        }
      });
    }
    // ─────────────────────────────────────────────────────────
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  initIcons();
}

function iniciarCountdownQR(minutos = 15) {
  const clock = document.getElementById('qrTimerClock');
  if (!clock) return;

  let segundos = minutos * 60;
  if (checkoutState.countdownTimer) clearInterval(checkoutState.countdownTimer);

  checkoutState.countdownTimer = setInterval(() => {
    segundos--;
    if (segundos <= 0) {
      clearInterval(checkoutState.countdownTimer);
      detenerTimersGateway();
      clock.textContent = '00:00 (EXPIRADO)';
      showToast('⚠️ El tiempo para pagar con QR ha expirado. El stock ha sido liberado.', 'warning', 6000);
      return;
    }

    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    clock.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

function iniciarPollingQR(referencia) {
  if (checkoutState.pollingTimer) clearInterval(checkoutState.pollingTimer);

  checkoutState.pollingTimer = setInterval(async () => {
    try {
      const res = await API.consultarEstadoPago(referencia);
      if (res && res.data) {
        if (res.data.estado_pago === 'PAGADO') {
          detenerTimersGateway();
          const modal = document.getElementById('paymentGatewayModal');
          if (modal) modal.hidden = true;

          showToast('🎉 ¡Pago QR confirmado exitosamente por el banco!', 'success', 5000);
          abrirModalExito(res.data.pedido, 'PAGADO');
        } else if (res.data.estado_pago === 'VENCIDO' || res.data.estado_pago === 'RECHAZADO') {
          detenerTimersGateway();
          showToast(`El pago fue marcado como ${res.data.estado_pago}.`, 'warning');
        }
      }
    } catch (_e) {
      // Ignorar errores transitorios de red durante polling
    }
  }, 3000);
}

function detenerTimersGateway() {
  if (checkoutState.pollingTimer) {
    clearInterval(checkoutState.pollingTimer);
    checkoutState.pollingTimer = null;
  }
  if (checkoutState.countdownTimer) {
    clearInterval(checkoutState.countdownTimer);
    checkoutState.countdownTimer = null;
  }
}

function abrirModalExito(pedido, estadoTexto) {
  const modal = document.getElementById('orderSuccessModal');
  if (!modal) return;

  const succCodigo = document.getElementById('succCodigoPedido');
  const succEstado = document.getElementById('succEstadoPedido');
  const succTotal  = document.getElementById('succTotal');
  const succNombre = document.getElementById('succClienteNombre');
  const rowGuia    = document.getElementById('rowSuccGuia');
  const succGuia   = document.getElementById('succGuiaEnvio');
  const rowRetiro  = document.getElementById('rowSuccCodigoRetiro');
  const succRetiro = document.getElementById('succCodigoRetiro');
  const btnWa      = document.getElementById('btnSuccWhatsApp');

  if (succCodigo) succCodigo.textContent = pedido.codigo_pedido;
  if (succEstado) succEstado.textContent = estadoTexto || pedido.estado_pedido;
  if (succTotal)  succTotal.textContent = `Bs. ${Number(pedido.total).toFixed(2)}`;
  if (succNombre) succNombre.textContent = pedido.cliente_nombre || 'Cliente';

  if (pedido.guia_envio) {
    if (rowGuia) rowGuia.hidden = false;
    if (succGuia) succGuia.textContent = pedido.guia_envio;
    if (rowRetiro) rowRetiro.hidden = true;
  } else if (pedido.codigo_retiro) {
    if (rowRetiro) rowRetiro.hidden = false;
    if (succRetiro) succRetiro.textContent = pedido.codigo_retiro;
    if (rowGuia) rowGuia.hidden = true;
  }

  if (btnWa) {
    const msg = `Hola Chocolates Para Ti, realicé el pedido ${pedido.codigo_pedido} por Bs. ${Number(pedido.total).toFixed(2)}. ${pedido.guia_envio ? `Mi guía es ${pedido.guia_envio}` : ''}`;
    btnWa.href = `https://wa.me/59171163789?text=${encodeURIComponent(msg)}`;
  }

  // Vaciar carrito
  appState.cart = [];
  updateCartCount();

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  initIcons();
}

/* ============================================================
   13. INICIALIZACIÓN GENERAL
   ============================================================ */

/**
 * Punto de entrada principal.
 * Se ejecuta cuando el DOM está completamente cargado.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar todos los módulos en orden
  initIcons();             // 1. Iconos SVG
  initHeader();            // 2. Navegación sticky y enlaces activos
  initHamburger();         // 3. Menú hamburguesa móvil
  initScrollAnimations();  // 4. Animaciones de entrada al hacer scroll
  initCurrencySelector();  // 5. Selector BOB / USD
  initStatsCounter();      // 6. Contadores animados de estadísticas
  initCatalog();           // 7. Catálogo dinámico, buscador en vivo y lista de deseos (Fase 4)
  initCart();              // 8. Carrito de compras interactivo
  initCheckout();          // 9. Checkout omnicanal, QR y pasarelas de pago (Fase 5A)
  initTrackingWidget();    // 10. Simulador de rastreo de pedidos
  initB2BForm();           // 11. Formulario corporativo B2B
  initContactForm();       // 12. Formulario de contacto general
  initWelcomeModal();      // 13. Modal de bienvenida y acceso a la tienda
  initAuth();              // 14. Autenticación, sesión y modales (Fase 2)

  // Toast de bienvenida (solo si no hay sesión abierta previa)
  setTimeout(() => {
    if (typeof API !== 'undefined' && !API.estaAutenticado()) {
      showToast('🍫 ¡Bienvenido a ChocoTi-Digital! El sabor de Sucre en tu pantalla.', 'success', 4000);
    }
  }, 1000);

  // Inicializar iconos nuevamente tras cualquier inyección dinámica tardía
  window.addEventListener('load', initIcons);

  console.info('🍫 ChocoTi-Digital iniciado correctamente — Chocolates Para Ti, Sucre Bolivia.');
});

/* ============================================================
   14. AUTENTICACIÓN, SESIÓN OMNICANAL Y PERFIL (FASE 2)
   ============================================================ */

function initAuth() {
  if (typeof API === 'undefined') {
    console.warn('[AUTH] Módulo API no detectado.');
    return;
  }

  // Elementos DOM del Header y Dropdown
  const headerAuthWrap   = document.getElementById('headerAuthWrap');
  const headerAuthBtn    = document.getElementById('headerAuthBtn');
  const headerAuthText   = document.getElementById('headerAuthText');
  const userDropdownMenu = document.getElementById('userDropdownMenu');
  const userDropdownName = document.getElementById('userDropdownName');
  const userDropdownBadge= document.getElementById('userDropdownBadge');
  const userDropdownEmail= document.getElementById('userDropdownEmail');
  const btnIrDashboard   = document.getElementById('btnIrDashboard');
  const btnAbrirPerfil   = document.getElementById('btnAbrirPerfil');
  const btnCerrarSesion  = document.getElementById('btnCerrarSesion');

  // Elementos del Banner de Bienvenida
  const roleWelcomeBanner = document.getElementById('roleWelcomeBanner');
  const bannerUserName    = document.getElementById('bannerUserName');
  const bannerUserBadge   = document.getElementById('bannerUserBadge');
  const bannerDashLink    = document.getElementById('bannerDashLink');
  const btnBannerClose    = document.getElementById('btnBannerClose');

  // Elementos del Modal de Login
  const loginModal        = document.getElementById('loginModal');
  const loginModalClose   = document.getElementById('loginModalClose');
  const loginModalForm    = document.getElementById('loginModalForm');
  const loginEmail        = document.getElementById('loginEmail');
  const loginPassword     = document.getElementById('loginPassword');
  const toggleModalPass   = document.getElementById('toggleModalPass');
  const loginModalAlert   = document.getElementById('loginModalAlert');
  const loginModalAlertText = document.getElementById('loginModalAlertText');
  const loginModalSubmit  = document.getElementById('loginModalSubmit');
  const loginSubmitText   = document.getElementById('loginSubmitText');
  const chkAutoRedirect   = document.getElementById('chkAutoRedirect');

  // Elementos del Modal de Perfil
  const profileModal      = document.getElementById('profileModal');
  const profileModalClose = document.getElementById('profileModalClose');
  const profileModalAlert = document.getElementById('profileModalAlert');
  const profileModalAlertText = document.getElementById('profileModalAlertText');
  const modalUserAvatar   = document.getElementById('modalUserAvatar');
  const profileModalTitle = document.getElementById('profileModalTitle');
  const modalUserRole     = document.getElementById('modalUserRole');
  const tabPaneDatos      = document.getElementById('tabPaneDatos');
  const tabPaneClave      = document.getElementById('tabPaneClave');
  const perfilDatosForm   = document.getElementById('perfilDatosForm');
  const perfilClaveForm   = document.getElementById('perfilClaveForm');

  // Campos de perfil
  const profNombre        = document.getElementById('profNombre');
  const profEmail         = document.getElementById('profEmail');
  const profTelefono      = document.getElementById('profTelefono');
  const profCiNit         = document.getElementById('profCiNit');
  const profRazonSocial   = document.getElementById('profRazonSocial');
  const profGroupRazonSocial = document.getElementById('profGroupRazonSocial');

  // ── 1. Actualizar UI según estado de sesión ──
  function updateAuthUI() {
    const sesion = API.obtenerSesion();

    if (sesion && sesion.usuario) {
      const u = sesion.usuario;
      const primerNombre = (u.nombre_completo || 'Usuario').split(' ')[0];
      const inicial = (u.nombre_completo || 'U').charAt(0).toUpperCase();

      // Header button
      headerAuthBtn.classList.add('logged-in');
      headerAuthText.innerHTML = `<span class="header-auth-avatar">${inicial}</span> ${primerNombre}`;
      headerAuthBtn.setAttribute('title', `${u.nombre_completo} (${u.rol})`);

      // Dropdown
      if (userDropdownName) userDropdownName.textContent = u.nombre_completo;
      if (userDropdownBadge) userDropdownBadge.textContent = u.rol;
      if (userDropdownEmail) userDropdownEmail.textContent = u.email;

      // Banner de bienvenida
      if (roleWelcomeBanner) {
        roleWelcomeBanner.hidden = false;
        if (bannerUserName) bannerUserName.textContent = u.nombre_completo;
        if (bannerUserBadge) bannerUserBadge.textContent = u.rol;
        if (bannerDashLink) {
          bannerDashLink.href = API.resolverRutaDashboard(u.rol);
        }
      }
    } else {
      // Estado invitado / sin sesión
      headerAuthBtn.classList.remove('logged-in');
      headerAuthText.textContent = 'Ingresar';
      headerAuthBtn.removeAttribute('title');
      if (userDropdownMenu) userDropdownMenu.hidden = true;
      if (roleWelcomeBanner) roleWelcomeBanner.hidden = true;
    }
  }

  // ── 2. Click en botón de Header ──
  if (headerAuthBtn) {
    headerAuthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (API.estaAutenticado()) {
        userDropdownMenu.hidden = !userDropdownMenu.hidden;
      } else {
        abrirLoginModal();
      }
    });
  }

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (userDropdownMenu && !userDropdownMenu.hidden && !headerAuthWrap.contains(e.target)) {
      userDropdownMenu.hidden = true;
    }
  });

  // Cerrar banner de bienvenida
  if (btnBannerClose) {
    btnBannerClose.addEventListener('click', () => {
      roleWelcomeBanner.hidden = true;
    });
  }

  // ── 3. Acciones del Dropdown ──
  if (btnIrDashboard) {
    btnIrDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      const sesion = API.obtenerSesion();
      if (sesion?.usuario?.rol) {
        window.location.href = API.resolverRutaDashboard(sesion.usuario.rol);
      }
    });
  }

  if (btnAbrirPerfil) {
    btnAbrirPerfil.addEventListener('click', () => {
      userDropdownMenu.hidden = true;
      abrirProfileModal();
    });
  }

  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      userDropdownMenu.hidden = true;
      if (confirm('¿Deseas cerrar tu sesión actual en ChocoTi-Digital?')) {
        localStorage.removeItem('chocoti_token');
        localStorage.removeItem('chocoti_usuario');
        updateAuthUI();
        showToast('🚪 Has cerrado sesión correctamente.', 'info', 3500);
      }
    });
  }

  // ── 4. Control del Modal de Login ──
  function abrirLoginModal() {
    loginModalAlert.hidden = true;
    loginModal.hidden = false;
    document.body.style.overflow = 'hidden';
    initIcons();
    setTimeout(() => loginEmail.focus(), 150);
  }

  function cerrarLoginModal() {
    loginModal.hidden = true;
    document.body.style.overflow = '';
  }

  if (loginModalClose) {
    loginModalClose.addEventListener('click', cerrarLoginModal);
  }

  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) cerrarLoginModal();
  });

  // Toggle mostrar contraseña en modal
  if (toggleModalPass) {
    toggleModalPass.addEventListener('click', () => {
      const isPass = loginPassword.type === 'password';
      loginPassword.type = isPass ? 'text' : 'password';
      toggleModalPass.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // Control de pestañas en modal (Login / Registro)
  const modalTabLogin = document.getElementById('modalTabLogin');
  const modalTabRegister = document.getElementById('modalTabRegister');
  const modalPaneLogin = document.getElementById('modalPaneLogin');
  const modalPaneRegister = document.getElementById('modalPaneRegister');

  if (modalTabLogin && modalTabRegister) {
    modalTabLogin.addEventListener('click', () => {
      modalTabLogin.classList.add('active');
      modalTabLogin.style.background = '';
      modalTabLogin.style.color = '';
      modalTabRegister.classList.remove('active');
      modalTabRegister.style.background = 'transparent';
      modalTabRegister.style.color = 'var(--color-text-mid)';
      modalPaneLogin.hidden = false;
      modalPaneRegister.hidden = true;
      loginModalAlert.hidden = true;
    });

    modalTabRegister.addEventListener('click', () => {
      modalTabRegister.classList.add('active');
      modalTabRegister.style.background = '';
      modalTabRegister.style.color = '';
      modalTabLogin.classList.remove('active');
      modalTabLogin.style.background = 'transparent';
      modalTabLogin.style.color = 'var(--color-text-mid)';
      modalPaneLogin.hidden = true;
      modalPaneRegister.hidden = false;
      loginModalAlert.hidden = true;
      initIcons();
    });
  }

  // Toggle tipo cliente en registro modal (Minorista / Corporativo)
  const lblModalMin = document.getElementById('lblModalMin');
  const lblModalCorp = document.getElementById('lblModalCorp');
  const modalFieldsCorp = document.getElementById('modalFieldsCorp');

  if (lblModalMin && lblModalCorp) {
    lblModalMin.addEventListener('click', () => {
      lblModalMin.style.background = 'rgba(212,175,55,0.1)';
      lblModalMin.style.borderColor = 'var(--color-gold)';
      lblModalCorp.style.background = '';
      lblModalCorp.style.borderColor = 'var(--color-border)';
      if (modalFieldsCorp) modalFieldsCorp.style.display = 'none';
      const rad = lblModalMin.querySelector('input');
      if (rad) rad.checked = true;
    });

    lblModalCorp.addEventListener('click', () => {
      lblModalCorp.style.background = 'rgba(212,175,55,0.1)';
      lblModalCorp.style.borderColor = 'var(--color-gold)';
      lblModalMin.style.background = '';
      lblModalMin.style.borderColor = 'var(--color-border)';
      if (modalFieldsCorp) modalFieldsCorp.style.display = 'block';
      const rad = lblModalCorp.querySelector('input');
      if (rad) rad.checked = true;
    });
  }

  // Toggle mostrar contraseña en registro modal
  const toggleModalRegPass = document.getElementById('toggleModalRegPass');
  const regModalPass = document.getElementById('regModalPass');
  if (toggleModalRegPass && regModalPass) {
    toggleModalRegPass.addEventListener('click', () => {
      const isPass = regModalPass.type === 'password';
      regModalPass.type = isPass ? 'text' : 'password';
      toggleModalRegPass.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // Envío del formulario de Registro en Modal
  const registerModalForm = document.getElementById('registerModalForm');
  if (registerModalForm) {
    registerModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginModalAlert.hidden = true;

      const nombre = document.getElementById('regModalNombre')?.value.trim();
      const email = document.getElementById('regModalEmail')?.value.trim();
      const pass = regModalPass?.value;
      const esCorp = document.querySelector('input[name="modal_tipo_cliente"]:checked')?.value === 'CORPORATIVO';
      const razon = document.getElementById('regModalRazon')?.value.trim();
      const nit = document.getElementById('regModalNit')?.value.trim();

      if (!nombre || !email || !pass) {
        mostrarAlertaLogin('Por favor completa los campos obligatorios.');
        return;
      }

      const regexComplejidad = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!regexComplejidad.test(pass)) {
        mostrarAlertaLogin('La contraseña debe tener mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número.');
        return;
      }

      if (esCorp && (!razon || !nit)) {
        mostrarAlertaLogin('Razón social y NIT son requeridos para clientes corporativos.');
        return;
      }

      const btn = document.getElementById('regModalSubmit');
      const txt = document.getElementById('regSubmitText');
      btn.disabled = true;
      txt.textContent = 'Creando cuenta...';

      try {
        const resp = await API.register({
          nombre_completo: nombre,
          email,
          password: pass,
          tipo_cliente: esCorp ? 'CORPORATIVO' : 'MINORISTA',
          razon_social: esCorp ? razon : null,
          ci_nit: esCorp ? nit : null,
        });

        API.guardarSesion(resp.token, resp.usuario, true);
        updateAuthUI();
        cerrarLoginModal();

        showToast(`🍫 ¡Bienvenido/a, ${resp.usuario.nombre_completo}!`, 'success', 4000);

        if (window.__checkoutPending) {
          window.__checkoutPending = false;
          if (typeof abrirFormularioCheckout === 'function') {
            abrirFormularioCheckout(resp.usuario);
          }
          return;
        }

        setTimeout(() => {
          window.location.href = API.resolverRutaDashboard(resp.usuario.rol);
        }, 1000);
      } catch (err) {
        mostrarAlertaLogin(err.message || 'Error al registrar la cuenta.');
      } finally {
        btn.disabled = false;
        txt.textContent = 'Crear Mi Cuenta';
        initIcons();
      }
    });
  }

  // Envío del formulario de Login
  if (loginModalForm) {
    loginModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginModalAlert.hidden = true;

      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      if (!email || !password) {
        mostrarAlertaLogin('Por favor completa todos los campos.');
        return;
      }

      // Estado cargando
      loginModalSubmit.disabled = true;
      loginSubmitText.textContent = 'Verificando credenciales...';

      try {
        const respuesta = await API.login(email, password);

        // Guardar token y usuario respetando checkbox de recordar
        const recordar = document.getElementById('loginRecordarCheck')?.checked || false;
        API.guardarSesion(respuesta.token, respuesta.usuario, recordar);

        // Actualizar UI en vivo y sincronizar lista de deseos del usuario
        updateAuthUI();
        cerrarLoginModal();
        if (typeof loadWishlist === 'function') {
          loadWishlist().then(() => {
            if (typeof renderProducts === 'function') renderProducts();
          });
        }

        showToast(`🍫 ¡Bienvenido/a, ${respuesta.usuario.nombre_completo}!`, 'success', 4000);

        if (window.__checkoutPending) {
          window.__checkoutPending = false;
          if (typeof abrirFormularioCheckout === 'function') {
            abrirFormularioCheckout(respuesta.usuario);
          }
          return;
        }

        // Redirección si está marcada o si es ADMIN / OPERADOR
        const debeRedirigir = chkAutoRedirect?.checked || ['ADMINISTRADOR', 'OPERADOR_ALMACEN'].includes(respuesta.usuario.rol);

        if (debeRedirigir) {
          const ruta = API.resolverRutaDashboard(respuesta.usuario.rol);
          showToast(`🚀 Abriendo Panel de ${respuesta.usuario.rol}...`, 'info', 2000);
          setTimeout(() => {
            window.location.href = ruta;
          }, 1200);
        }
      } catch (err) {
        const mensajeError = err?.data?.mensaje || err.message || 'Error de conexión con el servidor.';
        mostrarAlertaLogin(mensajeError);
      } finally {
        loginModalSubmit.disabled = false;
        loginSubmitText.textContent = 'Acceder a ChocoTi-Digital';
        initIcons();
      }
    });
  }

  function mostrarAlertaLogin(msg) {
    loginModalAlertText.textContent = msg;
    loginModalAlert.hidden = false;
  }

  // ── 5. Control del Modal de Perfil y Clave ──
  async function abrirProfileModal() {
    profileModalAlert.hidden = true;
    profileModal.hidden = false;
    document.body.style.overflow = 'hidden';
    initIcons();

    // Reset tabs
    activarTabPerfil('datos');

    // Cargar datos actuales
    try {
      const res = await API.getMe();
      const u = res.usuario;

      modalUserAvatar.textContent = (u.nombre_completo || 'U').charAt(0).toUpperCase();
      profileModalTitle.textContent = u.nombre_completo;
      modalUserRole.textContent = `${u.rol} ${u.almacen_nombre ? '· ' + u.almacen_nombre : ''}`;

      profNombre.value = u.nombre_completo || '';
      profEmail.value = u.email || '';
      profTelefono.value = u.telefono || '';
      profCiNit.value = u.ci_nit || '';

      if (u.tipo_cliente === 'CORPORATIVO') {
        profGroupRazonSocial.style.display = 'block';
        profRazonSocial.value = u.razon_social || '';
      } else {
        profGroupRazonSocial.style.display = 'none';
      }
    } catch (err) {
      const sesion = API.obtenerSesion();
      if (sesion?.usuario) {
        const u = sesion.usuario;
        profNombre.value = u.nombre_completo || '';
        profEmail.value = u.email || '';
      }
    }
  }

  function cerrarProfileModal() {
    profileModal.hidden = true;
    document.body.style.overflow = '';
  }

  if (profileModalClose) {
    profileModalClose.addEventListener('click', cerrarProfileModal);
  }

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) cerrarProfileModal();
  });

  // Cambio de pestañas
  function activarTabPerfil(tabName) {
    document.querySelectorAll('.profile-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.profileTab === tabName);
    });
    tabPaneDatos.hidden = tabName !== 'datos';
    tabPaneClave.hidden = tabName !== 'clave';
    profileModalAlert.hidden = true;
    initIcons();
  }

  document.querySelectorAll('.profile-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activarTabPerfil(btn.dataset.profileTab);
    });
  });

  // Guardar Datos Personales
  if (perfilDatosForm) {
    perfilDatosForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      profileModalAlert.hidden = true;

      const payload = {
        nombre_completo: profNombre.value.trim(),
        telefono: profTelefono.value.trim(),
        ci_nit: profCiNit.value.trim(),
        razon_social: profRazonSocial ? profRazonSocial.value.trim() : undefined,
      };

      try {
        const res = await API.updatePerfil(payload);
        mostrarAlertaPerfil('✅ Perfil actualizado exitosamente.', 'success');

        // Actualizar datos de sesión local
        const sesion = API.obtenerSesion();
        if (sesion) {
          sesion.usuario = { ...sesion.usuario, ...res.usuario };
          API.guardarSesion(sesion.token, sesion.usuario);
          updateAuthUI();
        }
        showToast('✅ Perfil guardado con éxito.', 'success', 3000);
      } catch (err) {
        mostrarAlertaPerfil('❌ ' + (err?.data?.mensaje || err.message), 'danger');
      }
    });
  }

  // Cambiar Contraseña
  if (perfilClaveForm) {
    perfilClaveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      profileModalAlert.hidden = true;

      const passActual = document.getElementById('passActual').value;
      const passNueva = document.getElementById('passNueva').value;
      const passConfirmar = document.getElementById('passConfirmar').value;

      if (!passActual || !passNueva || !passConfirmar) {
        mostrarAlertaPerfil('Por favor completa todos los campos de contraseña.', 'danger');
        return;
      }

      if (passNueva !== passConfirmar) {
        mostrarAlertaPerfil('La nueva contraseña y su confirmación no coinciden.', 'danger');
        return;
      }

      try {
        const res = await API.cambiarPassword({
          password_actual: passActual,
          password_nueva: passNueva,
          password_confirmar: passConfirmar,
        });

        mostrarAlertaPerfil('✅ ' + (res.mensaje || 'Contraseña cambiada con éxito.'), 'success');
        perfilClaveForm.reset();
        showToast('🔑 Contraseña actualizada exitosamente.', 'success', 3500);
      } catch (err) {
        mostrarAlertaPerfil('❌ ' + (err?.data?.mensaje || err.message), 'danger');
      }
    });
  }

  function mostrarAlertaPerfil(msg, tipo = 'danger') {
    profileModalAlert.className = `auth-alert auth-alert--${tipo}`;
    profileModalAlertText.textContent = msg;
    profileModalAlert.hidden = false;
  }

  // Inicializar estado al cargar
  updateAuthUI();
}
