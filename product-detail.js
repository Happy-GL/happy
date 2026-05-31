const detailRoot = document.querySelector("[data-product-detail]");
const detailState = document.querySelector("[data-detail-state]");
const detailStateMessage = document.querySelector("[data-detail-state-message]");
const detailMedia = document.querySelector("[data-detail-media]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailCategory = document.querySelector("[data-detail-category]");
const detailType = document.querySelector("[data-detail-type]");
const detailPrice = document.querySelector("[data-detail-price]");
const detailDescription = document.querySelector("[data-detail-description]");
const detailTags = document.querySelector("[data-detail-tags]");
const detailTagsSection = document.querySelector("[data-tags-section]");
const detailBrand = document.querySelector("[data-detail-brand]");
const detailBrandName = document.querySelector("[data-detail-brand-name]");
const detailSource = document.querySelector("[data-detail-source]");
const detailPublished = document.querySelector("[data-detail-published]");
const publishedWrap = document.querySelector("[data-published-wrap]");
const detailActions = document.querySelector("[data-detail-actions]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mainNav = document.querySelector("[data-nav]");
const accountModal = document.querySelector("[data-account-modal]");
const accountModalSubtitle = document.querySelector("[data-account-modal-subtitle]");
const accountOptions = document.querySelector("[data-account-options]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");

const tshirtMockupImage = "assets/mockups/tshirt-black-front.png";
const SHOP_RETURN_STATE_KEY = "happyShopReturnState";
const SHOP_RETURN_STATE_MAX_AGE = 1000 * 60 * 45;
let links = {};

const categoryLabels = {
  tshirt: "T-SHIRT",
  wallpaper: "WALLPAPER",
  "dark-art": "DARK ART"
};

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

function applyExternalAttributes(element, url) {
  if (!element || !isExternalLink(url)) return;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
}

function applyLink(element, url) {
  if (!element || !url) return;
  element.href = url;
  applyExternalAttributes(element, url);
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

function createFallback(label = "Image missing") {
  const fallback = document.createElement("div");
  fallback.className = "image-fallback";
  fallback.textContent = label;
  return fallback;
}

function createImage(src, alt) {
  const image = document.createElement("img");
  image.src = src || "";
  image.alt = alt || "";
  image.loading = "eager";
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

async function fetchProductFile(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} request failed: ${response.status}`);

    const data = await response.json();
    return { loaded: true, products: Array.isArray(data) ? data : [] };
  } catch (error) {
    console.warn(error);
    return { loaded: false, products: [] };
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

async function loadProducts() {
  const [baseProducts, importedProducts] = await Promise.all([
    fetchProductFile("data/products.json"),
    fetchProductFile("data/deviantart-products.json")
  ]);

  if (!baseProducts.loaded && !importedProducts.loaded) {
    throw new Error("Product data could not be loaded.");
  }

  return mergeProductLists(baseProducts.products, importedProducts.products);
}

function getCurrentProductId() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function findProduct(products, productId) {
  return products.find((product) => product.id === productId || getProductKey(product) === productId);
}

function getSourceUrl(product) {
  return product.sourceUrl || product.source?.url || product.link || "";
}

function getSourceLabel(product) {
  const platform = typeof product.source === "string" ? product.source : product.source?.platform;
  if (/deviant/i.test(platform || "")) return "DeviantArt";
  return platform || product.author || "Happy Creative Ecosystem";
}

function getBrandName(product) {
  return product.brand || brandAccountMeta[product.brandKey]?.name || "Happy Creative Ecosystem";
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function createAction(label, href, variant = "secondary") {
  const action = document.createElement("a");
  action.className = `button button-${variant}`;
  action.href = href || "#";
  action.textContent = label;
  applyExternalAttributes(action, href);
  return action;
}

function readShopReturnState() {
  try {
    const rawState = sessionStorage.getItem(SHOP_RETURN_STATE_KEY);
    if (!rawState) return null;

    const state = JSON.parse(rawState);
    const isRecent = Date.now() - Number(state.timestamp || 0) <= SHOP_RETURN_STATE_MAX_AGE;
    return isRecent ? state : null;
  } catch (error) {
    console.warn(error);
    return null;
  }
}

function isSameOriginUrl(url) {
  if (!url) return false;

  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function goBackToProducts(event) {
  event.preventDefault();

  const returnState = readShopReturnState();
  const hasSameSiteHistory = isSameOriginUrl(document.referrer);

  if ((returnState || hasSameSiteHistory) && window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = returnState?.url || "index.html#shop";
}

function wireProductBackLinks(scope = document) {
  scope.querySelectorAll("[data-product-back]").forEach((link) => {
    link.addEventListener("click", goBackToProducts);
  });
}

function renderActions(product) {
  detailActions.innerHTML = "";

  const sourceUrl = getSourceUrl(product);
  const shopUrl = product.category === "tshirt"
    ? product.link || links?.brands?.happyGL?.teePublic || "https://www.teepublic.com/user/happy-gl"
    : "";

  if (sourceUrl) {
    detailActions.append(createAction("Open on DeviantArt", sourceUrl, "secondary"));
  }

  if (shopUrl && shopUrl !== sourceUrl) {
    detailActions.append(createAction("Shop on TeePublic", shopUrl, "primary"));
  }

  const backAction = createAction("Back to Products", "index.html#shop", "secondary");
  backAction.dataset.productBack = "";
  backAction.addEventListener("click", goBackToProducts);
  detailActions.append(backAction);
}

function renderTags(tags) {
  detailTags.innerHTML = "";

  if (!tags.length) {
    const empty = document.createElement("p");
    empty.className = "detail-empty-note";
    empty.textContent = "No tags available.";
    detailTags.append(empty);
    return;
  }

  tags.forEach((tag) => {
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.textContent = tag;
    detailTags.append(pill);
  });
}

function showState(message) {
  if (detailRoot) detailRoot.hidden = true;
  if (detailStateMessage) detailStateMessage.textContent = message;
  if (detailState) detailState.hidden = false;
}

function renderProduct(product) {
  const category = product.category || "";
  const brandName = getBrandName(product);
  const tags = normalizeTags(product.tags);
  const published = formatDate(product.publishedAt);

  detailRoot.dataset.category = category;
  detailMedia.dataset.category = category;
  detailMedia.innerHTML = "";
  detailMedia.append(createProductVisual(product));

  detailBrand.textContent = brandName;
  detailBrandName.textContent = brandName;
  detailCategory.textContent = categoryLabels[category] || category || "Product";
  detailTitle.textContent = product.title || "Untitled Product";
  detailType.textContent = product.type || "Creative Product";
  detailPrice.textContent = product.price || "";
  detailDescription.textContent = product.description?.trim() || "Description will appear here after import.";
  detailSource.textContent = getSourceLabel(product);

  if (published) {
    detailPublished.textContent = published;
    publishedWrap.hidden = false;
  } else {
    publishedWrap.hidden = true;
  }

  renderTags(tags);
  renderActions(product);

  document.title = `${product.title || "Product"} | Happy Creative Ecosystem`;
  detailState.hidden = true;
  detailRoot.hidden = false;
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

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
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

async function initProductDetail() {
  wireMobileMenu();
  wireAccountModal();
  wireProductBackLinks();
  await loadLinks();

  try {
    const productId = getCurrentProductId();
    if (!productId) {
      showState("Product not found.");
      return;
    }

    const products = await loadProducts();
    const product = findProduct(products, productId);

    if (!product) {
      showState("Product not found.");
      return;
    }

    renderProduct(product);
  } catch (error) {
    console.error(error);
    showState("Product not found.");
  }
}

initProductDetail();
