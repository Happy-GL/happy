const productGrid = document.querySelector("[data-products]");
const productPagination = document.querySelector("[data-product-pagination]");
const productStatus = document.querySelector("[data-product-status]");
const filterTabs = document.querySelectorAll("[data-filter]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mainNav = document.querySelector("[data-nav]");
const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');
const header = document.querySelector("[data-header]");
const accountModal = document.querySelector("[data-account-modal]");
const accountModalSubtitle = document.querySelector("[data-account-modal-subtitle]");
const accountOptions = document.querySelector("[data-account-options]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");

let products = [];
let activeFilter = "all";
let currentPage = 1;
let links = {};

const SHOP_RETURN_STATE_KEY = "happyShopReturnState";
const SHOP_RETURN_STATE_MAX_AGE = 1000 * 60 * 45;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const categoryLabels = {
  tshirt: "T-SHIRT",
  wallpaper: "WALLPAPER",
  "dark-art": "DARK ART"
};

const categoryButtonLabels = {
  tshirt: "Shop",
  wallpaper: "View",
  "dark-art": "View"
};

const tshirtMockupImage = "assets/mockups/tshirt-black-front.png";
const PRODUCTS_PER_PAGE = 16;

const categoryCollections = [
  {
    key: "tshirt",
    title: "T-Shirt Designs",
    subtitle: "Anime, game, and original apparel designs."
  },
  {
    key: "wallpaper",
    title: "Anime Wallpapers",
    subtitle: "High-quality wallpapers for desktop and mobile."
  },
  {
    key: "dark-art",
    title: "Dark Art",
    subtitle: "Original dark illustrations and fantasy-inspired artworks."
  }
];

const brandAccountMeta = {
  happyGL: {
    name: "Happy GL",
    label: "Anime & Game Designs"
  },
  happyFL: {
    name: "Happy FL",
    label: "Original Dark Art"
  },
  happyAL: {
    name: "Happy AL",
    label: "Anime Wallpapers"
  }
};

const platformLabels = {
  deviantArt: "DeviantArt",
  teePublic: "TeePublic",
  instagram: "Instagram",
  reddit: "Reddit",
  x: "X",
  pinterest: "Pinterest"
};

function getValueByPath(source, path) {
  if (!source || !path) return "";
  return path.split(".").reduce((current, key) => current?.[key], source) || "";
}

function isExternalLink(url) {
  return /^https?:\/\//i.test(url);
}

function applyLink(element, url) {
  if (!element || !url) return;
  element.href = url;

  if (isExternalLink(url)) {
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  }
}

function getPlatformAccounts(platformKey) {
  const platformLinks = links?.platforms?.[platformKey] || {};
  return Object.entries(platformLinks)
    .map(([brandKey, url]) => ({
      brandKey,
      url,
      ...(brandAccountMeta[brandKey] || { name: brandKey, label: "Happy Profile" })
    }))
    .filter((account) => account.url);
}

function openAccountModal(platformKey, accounts) {
  if (!accountModal || !accountOptions) return;

  const platformName = platformLabels[platformKey] || "this platform";
  accountModalSubtitle.textContent = `Select which Happy profile you want to open on ${platformName}.`;
  accountOptions.innerHTML = "";

  accounts.forEach((account) => {
    const option = document.createElement("a");
    option.className = "account-option";
    option.dataset.brand = account.brandKey;
    option.href = account.url;
    option.target = "_blank";
    option.rel = "noopener noreferrer";
    option.innerHTML = `
      <strong>${account.name}</strong>
      <span>${account.label}</span>
      <small>Open ${platformName}</small>
    `;
    option.addEventListener("click", closeAccountModal);
    accountOptions.append(option);
  });

  accountModal.hidden = false;
  accountModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAccountModal() {
  if (!accountModal) return;
  accountModal.hidden = true;
  accountModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function applyPlatformLink(element) {
  const platformKey = element.dataset.platform;
  const accounts = getPlatformAccounts(platformKey);

  if (!accounts.length) return;

  if (accounts.length === 1) {
    applyLink(element, accounts[0].url);
    return;
  }

  element.href = "#";
  element.removeAttribute("target");
  element.removeAttribute("rel");
  element.setAttribute("aria-haspopup", "dialog");
  element.addEventListener("click", (event) => {
    event.preventDefault();
    openAccountModal(platformKey, accounts);
  });
}

function setStatus(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

function createFallback(label = "Image coming soon") {
  const fallback = document.createElement("div");
  fallback.className = "image-fallback";
  fallback.textContent = label;
  return fallback;
}

function createImage(src, alt) {
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createFallback("Image missing"));
  }, { once: true });
  return image;
}

function createTshirtMockup(product) {
  const preview = document.createElement("div");
  preview.className = "tshirt-mockup-preview";

  const base = createImage(tshirtMockupImage, `${product.title} black T-shirt mockup`);
  base.className = "tshirt-base";

  const artworkWrap = document.createElement("div");
  artworkWrap.className = "tshirt-artwork-wrap";

  const artwork = createImage(product.image, product.title);
  artwork.className = "tshirt-artwork";

  artworkWrap.append(artwork);
  preview.append(base, artworkWrap);

  return preview;
}

function createProductVisual(product) {
  if (product.category === "tshirt") {
    return createTshirtMockup(product);
  }

  return createImage(product.image, product.title);
}

function getProductsForFilter() {
  if (activeFilter === "all") return products;
  return products.filter((product) => product.category === activeFilter);
}

function clearPagination() {
  if (!productPagination) return;
  productPagination.innerHTML = "";
  productPagination.hidden = true;
}

function getCollectionMeta(categoryKey) {
  return categoryCollections.find((collection) => collection.key === categoryKey);
}

function getEmptyProductMessage(categoryKey) {
  const title = getCollectionMeta(categoryKey)?.title;
  return title
    ? `No ${title} yet. New works will appear here after DeviantArt import.`
    : "No products yet. New works will appear here after DeviantArt import.";
}

async function fetchProductFile(path, optional = false) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} request failed: ${response.status}`);

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (optional) {
      console.warn(error);
      return [];
    }

    throw error;
  }
}

function getProductKey(product) {
  return product?.sourceUrl || product?.source?.url || product?.id || product?.image || `${product?.category || "product"}-${product?.title || ""}`;
}

function mergeProductLists(...productLists) {
  const productMap = new Map();

  productLists.flat().forEach((product) => {
    const key = getProductKey(product);
    if (key) productMap.set(key, product);
  });

  return [...productMap.values()];
}

let carouselCleanups = [];

function getProductId(product) {
  return product?.id || getProductKey(product);
}

function getProductDetailUrl(product) {
  return `product.html?id=${encodeURIComponent(getProductId(product))}`;
}

function isValidFilter(filter) {
  return filter === "all" || categoryCollections.some((collection) => collection.key === filter);
}

function setActiveFilter(filter) {
  activeFilter = isValidFilter(filter) ? filter : "all";
  filterTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === activeFilter);
  });
}

function readShopReturnState() {
  try {
    const rawState = sessionStorage.getItem(SHOP_RETURN_STATE_KEY);
    if (!rawState) return null;

    const state = JSON.parse(rawState);
    const isRecent = Date.now() - Number(state.timestamp || 0) <= SHOP_RETURN_STATE_MAX_AGE;
    if (!isRecent || !isValidFilter(state.activeFilter)) {
      sessionStorage.removeItem(SHOP_RETURN_STATE_KEY);
      return null;
    }

    return state;
  } catch (error) {
    console.warn(error);
    sessionStorage.removeItem(SHOP_RETURN_STATE_KEY);
    return null;
  }
}

function getCarouselScrollState() {
  const scrollState = {};

  document.querySelectorAll(".collection-track").forEach((track) => {
    const category = track.closest(".product-collection")?.dataset.category;
    if (category) scrollState[category] = track.scrollLeft;
  });

  return scrollState;
}

function restoreCarouselScrollState(state) {
  if (!state?.carouselScroll) return;

  window.requestAnimationFrame(() => {
    document.querySelectorAll(".collection-track").forEach((track) => {
      const category = track.closest(".product-collection")?.dataset.category;
      const scrollLeft = Number(state.carouselScroll[category]);

      if (category && Number.isFinite(scrollLeft)) {
        track.scrollLeft = scrollLeft;
        track.dispatchEvent(new Event("scroll"));
      }
    });
  });
}

// Save the exact shop state before opening an internal product detail page.
function saveShopReturnState(product) {
  try {
    sessionStorage.setItem(SHOP_RETURN_STATE_KEY, JSON.stringify({
      url: window.location.href,
      path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      scrollY: window.scrollY,
      activeFilter,
      currentPage,
      category: activeFilter === "all" ? "" : activeFilter,
      clickedProductId: getProductId(product),
      carouselScroll: getCarouselScrollState(),
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn(error);
  }
}

function restoreScrollPosition(scrollY) {
  const top = Math.max(Number(scrollY) || 0, 0);
  const scroll = () => window.scrollTo({ top, left: 0, behavior: "auto" });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scroll();
      window.setTimeout(() => {
        scroll();
        sessionStorage.removeItem(SHOP_RETURN_STATE_KEY);
      }, 140);
    });
  });
}

// Restore the saved tab, pagination page, and scroll after products finish rendering.
function restoreShopReturnState() {
  const state = readShopReturnState();
  if (!state) return false;

  setActiveFilter(state.activeFilter);
  currentPage = Math.max(Number.parseInt(state.currentPage, 10) || 1, 1);
  renderProducts();
  restoreCarouselScrollState(state);
  restoreScrollPosition(state.scrollY);

  return true;
}

function openProductDetail(product, event) {
  saveShopReturnState(product);

  if (event) {
    if (event.defaultPrevented) return;

    const isPlainLeftClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!isPlainLeftClick) return;

    event.preventDefault();
  }

  window.location.assign(getProductDetailUrl(product));
}

function clearCarouselControls() {
  carouselCleanups.forEach((cleanup) => cleanup());
  carouselCleanups = [];
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.category = product.category;

  const detailUrl = getProductDetailUrl(product);

  const media = document.createElement("a");
  media.className = "product-media product-detail-link";
  media.href = detailUrl;
  media.setAttribute("aria-label", `View details for ${product.title}`);
  media.addEventListener("click", (event) => openProductDetail(product, event));

  const badge = document.createElement("span");
  badge.className = "category-badge";
  badge.textContent = categoryLabels[product.category] || product.category || "Product";

  media.append(createProductVisual(product), badge);

  const body = document.createElement("div");
  body.className = "product-body";

  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.className = "product-title-link product-detail-link";
  titleLink.href = detailUrl;
  titleLink.textContent = product.title;
  titleLink.setAttribute("aria-label", `View details for ${product.title}`);
  titleLink.addEventListener("click", (event) => openProductDetail(product, event));
  title.append(titleLink);

  const type = document.createElement("p");
  type.textContent = product.type;

  const meta = document.createElement("div");
  meta.className = "product-meta";

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = product.price;

  const action = document.createElement("a");
  action.className = "product-action-link";
  action.href = product.link || "#";
  action.textContent = product.buttonText || categoryButtonLabels[product.category] || "Open";
  action.setAttribute("aria-label", `${action.textContent} ${product.title}`);
  action.addEventListener("click", (event) => event.stopPropagation());

  meta.append(price, action);
  body.append(title, type, meta);

  card.append(media, body);
  if (isExternalLink(product.link)) {
    action.target = "_blank";
    action.rel = "noopener noreferrer";
  }

  return card;
}

function updateCarouselButtons(track, prevButton, nextButton) {
  const maxScrollLeft = track.scrollWidth - track.clientWidth;
  const hasOverflow = maxScrollLeft > 2;

  prevButton.hidden = !hasOverflow;
  nextButton.hidden = !hasOverflow;

  if (!hasOverflow) return;

  prevButton.disabled = track.scrollLeft <= 2;
  nextButton.disabled = track.scrollLeft >= maxScrollLeft - 2;
}

function getCarouselStep(track) {
  const firstCard = track.querySelector(".product-card");
  const styles = window.getComputedStyle(track);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  return firstCard ? firstCard.getBoundingClientRect().width + gap : track.clientWidth;
}

function wireCarouselControls(track, prevButton, nextButton) {
  let rafId = 0;

  const scheduleUpdate = () => {
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(() => updateCarouselButtons(track, prevButton, nextButton));
  };

  prevButton.addEventListener("click", () => {
    track.scrollBy({ left: -getCarouselStep(track), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    track.scrollBy({ left: getCarouselStep(track), behavior: "smooth" });
  });

  track.addEventListener("scroll", scheduleUpdate, { passive: true });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(track);
    carouselCleanups.push(() => {
      observer.disconnect();
      track.removeEventListener("scroll", scheduleUpdate);
      window.cancelAnimationFrame(rafId);
    });
  } else {
    window.addEventListener("resize", scheduleUpdate);
    carouselCleanups.push(() => {
      window.removeEventListener("resize", scheduleUpdate);
      track.removeEventListener("scroll", scheduleUpdate);
      window.cancelAnimationFrame(rafId);
    });
  }

  scheduleUpdate();
}

function createCarouselButton(direction, label) {
  const button = document.createElement("button");
  button.className = `carousel-button carousel-button-${direction}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.innerHTML = direction === "prev"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';
  return button;
}

function renderProductCollection(collection, collectionProducts) {
  const section = document.createElement("section");
  section.className = "product-collection";
  section.dataset.category = collection.key;
  section.setAttribute("aria-labelledby", `collection-title-${collection.key}`);

  const header = document.createElement("div");
  header.className = "collection-header";

  const copy = document.createElement("div");
  copy.className = "collection-copy";
  copy.innerHTML = `
    <h3 id="collection-title-${collection.key}">${collection.title}</h3>
    <p>${collection.subtitle}</p>
  `;

  const controls = document.createElement("div");
  controls.className = "collection-controls";
  const prevButton = createCarouselButton("prev", `Scroll ${collection.title} left`);
  const nextButton = createCarouselButton("next", `Scroll ${collection.title} right`);
  controls.append(prevButton, nextButton);

  const carousel = document.createElement("div");
  carousel.className = "collection-carousel";

  const track = document.createElement("div");
  track.className = "collection-track";
  track.dataset.visible = String(Math.min(Math.max(collectionProducts.length, 3), 4));
  track.setAttribute("aria-label", `${collection.title} products`);
  track.tabIndex = 0;

  collectionProducts.forEach((product) => {
    track.append(createProductCard(product));
  });

  header.append(copy, controls);

  if (collectionProducts.length) {
    carousel.append(track);
    section.append(header, carousel);
    wireCarouselControls(track, prevButton, nextButton);
  } else {
    const empty = document.createElement("div");
    empty.className = "collection-empty";
    empty.textContent = getEmptyProductMessage(collection.key);
    controls.hidden = true;
    section.append(header, empty);
  }

  return section;
}

function renderGroupedProducts() {
  setStatus(productStatus, "");
  clearPagination();

  categoryCollections.forEach((collection) => {
    const collectionProducts = products.filter((product) => product.category === collection.key);
    productGrid.append(renderProductCollection(collection, collectionProducts));
  });
}

function getSafePage(page, totalPages) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function scrollToShopProducts() {
  const shopSection = document.querySelector("#shop");
  if (shopSection) {
    scrollToSection(shopSection);
  }
}

function renderPagination(totalItems, page) {
  if (!productPagination) return;

  const totalPages = Math.ceil(totalItems / PRODUCTS_PER_PAGE);
  productPagination.innerHTML = "";
  productPagination.dataset.category = activeFilter;

  if (totalPages <= 1) {
    productPagination.hidden = true;
    return;
  }

  productPagination.hidden = false;

  const createButton = (label, targetPage, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.page = String(targetPage);
    button.className = "pagination-button";

    if (options.kind) button.classList.add(`pagination-${options.kind}`);
    if (options.active) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "page");
    }
    if (options.disabled) button.disabled = true;

    button.addEventListener("click", () => {
      if (button.disabled || currentPage === targetPage) return;
      currentPage = getSafePage(targetPage, totalPages);
      renderProducts();
      scrollToShopProducts();
    });

    return button;
  };

  productPagination.append(createButton("Previous", page - 1, {
    kind: "prev",
    disabled: page === 1
  }));

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    productPagination.append(createButton(String(pageNumber), pageNumber, {
      kind: "page",
      active: pageNumber === page
    }));
  }

  productPagination.append(createButton("Next", page + 1, {
    kind: "next",
    disabled: page === totalPages
  }));
}

function renderPaginatedProducts(category, page = 1) {
  const visibleProducts = products.filter((product) => product.category === category);
  const totalPages = Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE);
  currentPage = getSafePage(page, totalPages);

  if (!visibleProducts.length) {
    clearPagination();
    setStatus(productStatus, getEmptyProductMessage(category));
    return;
  }

  setStatus(productStatus, "");

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = visibleProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  pageProducts.forEach((product) => {
    productGrid.append(createProductCard(product));
  });

  renderPagination(visibleProducts.length, currentPage);
}

function renderProducts() {
  if (!productGrid) return;

  clearCarouselControls();
  productGrid.innerHTML = "";
  productGrid.classList.toggle("is-grouped", activeFilter === "all");
  productGrid.classList.toggle("is-filtered", activeFilter !== "all");

  if (activeFilter === "all") {
    renderGroupedProducts();
    return;
  }

  renderPaginatedProducts(activeFilter, currentPage);
}

function wireFilters() {
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveFilter(tab.dataset.filter);
      currentPage = 1;
      renderProducts();
    });
  });
}

function wireMobileMenu() {
  if (!menuToggle || !mainNav) return;

  function closeMenu() {
    mainNav.classList.remove("is-open");
    menuToggle.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function scrollToSection(target) {
  const headerHeight = header?.offsetHeight || 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const offset = headerHeight + 18;
  window.scrollTo({
    top: Math.max(targetTop - offset, 0),
    behavior: "smooth"
  });
}

function wireSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#" || !targetId.startsWith("#")) return;

      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();
      scrollToSection(target);
      history.pushState(null, "", targetId);
    });
  });
}

function wireActiveNav() {
  const sections = [...navLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-38% 0px -52% 0px", threshold: 0.01 });

  sections.forEach((section) => observer.observe(section));
}

function wireAccountModal() {
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", closeAccountModal);
  });

  accountModal?.addEventListener("click", (event) => {
    if (event.target === accountModal) {
      closeAccountModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAccountModal();
    }
  });
}

function wireReturnStateRestore() {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && products.length) {
      restoreShopReturnState();
    }
  });
}

async function loadProducts() {
  try {
    const baseProducts = await fetchProductFile("data/products.json");
    const importedProducts = await fetchProductFile("data/deviantart-products.json", true);
    products = mergeProductLists(baseProducts, importedProducts);

    if (!restoreShopReturnState()) {
      renderProducts();
    }
  } catch (error) {
    console.error(error);
    setStatus(productStatus, "Products could not be loaded. Check data/products.json and try again.");
  }
}

async function loadLinks() {
  try {
    const response = await fetch("data/links.json");
    if (!response.ok) throw new Error(`Links data request failed: ${response.status}`);

    links = await response.json();
    document.querySelectorAll("[data-link-path]").forEach((element) => {
      const url = getValueByPath(links, element.dataset.linkPath);
      applyLink(element, url);
    });
    document.querySelectorAll("[data-platform]").forEach(applyPlatformLink);
  } catch (error) {
    console.error(error);
  }
}

wireFilters();
wireMobileMenu();
wireSmoothScroll();
wireActiveNav();
wireAccountModal();
wireReturnStateRestore();
loadProducts();
loadLinks();

// Product names, prices, image paths, and placeholder links live in data/products.json.
// Imported DeviantArt RSS products live in data/deviantart-products.json.
// Social and platform URLs live in data/links.json.
