const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const IMPORT_LIMIT = 100;
const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCES_FILE = path.join(ROOT_DIR, "data", "deviantart-sources.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "data", "deviantart-products.json");

function buildFeedUrl(username) {
  return `https://backend.deviantart.com/rss.xml?type=deviation&q=by:${username}+sort:time+meta:all`;
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function stripCdata(value = "") {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeEntities(value = "") {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: "\""
  };

  return stripCdata(value)
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const isHex = entity[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }

      return entities[entity.toLowerCase()] || match;
    })
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTagValue(xml, tagNames) {
  for (const tagName of tagNames) {
    const tag = escapeRegExp(tagName);
    const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match?.[1]) return decodeEntities(match[1]);
  }

  return "";
}

function getTagValues(xml, tagNames) {
  const values = [];

  for (const tagName of tagNames) {
    const tag = escapeRegExp(tagName);
    const tagRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let match;

    while ((match = tagRegex.exec(xml)) !== null) {
      const value = decodeEntities(match[1] || "");
      if (value) values.push(value);
    }
  }

  return values;
}

function getTagAttributes(xml, tagNames) {
  const attributes = [];

  for (const tagName of tagNames) {
    const tag = escapeRegExp(tagName);
    const tagRegex = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
    let match;

    while ((match = tagRegex.exec(xml)) !== null) {
      attributes.push(match[1] || "");
    }
  }

  return attributes;
}

function getAttributeValue(attributes, name) {
  const attr = escapeRegExp(name);
  const match = attributes.match(new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return decodeEntities(match?.[2] || match?.[3] || "");
}

function getFirstAttribute(xml, tagNames, attributeName, predicate = () => true) {
  for (const attributes of getTagAttributes(xml, tagNames)) {
    if (!predicate(attributes)) continue;

    const value = getAttributeValue(attributes, attributeName);
    if (value) return value;
  }

  return "";
}

function getDescriptionImage(xml) {
  const description = getTagValue(xml, ["description", "content:encoded"]);
  const match = description.match(/<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
  return decodeEntities(match?.[2] || match?.[3] || "");
}

function getImageUrl(itemXml) {
  return (
    getFirstAttribute(itemXml, ["media:content"], "url", (attrs) => !/medium\s*=\s*["']?video/i.test(attrs)) ||
    getFirstAttribute(itemXml, ["media:thumbnail"], "url") ||
    getFirstAttribute(itemXml, ["enclosure"], "url", (attrs) => /type\s*=\s*["']image\//i.test(attrs)) ||
    getDescriptionImage(itemXml)
  );
}

function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemDescription(itemXml) {
  const description = getTagValue(itemXml, ["media:description", "description", "content:encoded"]);
  return stripHtml(description);
}

function getItemTags(itemXml) {
  const keywordText = getTagValue(itemXml, ["media:keywords", "keywords"]);
  const keywordTags = keywordText
    ? keywordText.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  const categoryTags = getTagValues(itemXml, ["category", "media:category", "dc:subject"]);
  const tagMap = new Map();

  [...keywordTags, ...categoryTags].forEach((tag) => {
    const cleanTag = stripHtml(tag).replace(/^#+/, "").trim();
    const key = cleanTag.toLowerCase();
    if (cleanTag && !tagMap.has(key)) tagMap.set(key, cleanTag);
  });

  return [...tagMap.values()];
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const link = getTagValue(itemXml, ["link", "guid"]);
    const publicationDate = getTagValue(itemXml, ["pubDate", "published", "dc:date"]);
    const parsedDate = publicationDate ? new Date(publicationDate) : null;

    items.push({
      title: getTagValue(itemXml, ["title", "media:title"]) || "Untitled DeviantArt Work",
      link,
      image: getImageUrl(itemXml),
      publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : publicationDate,
      author: getTagValue(itemXml, ["media:credit", "dc:creator", "author"]),
      description: getItemDescription(itemXml),
      tags: getItemTags(itemXml)
    });
  }

  return items;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function getUrlSlug(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

function createStableId(source, item) {
  const slug = slugify(getUrlSlug(item.link) || item.title);
  const hash = crypto
    .createHash("sha1")
    .update(`${source.brandKey}:${item.link || item.title}:${item.publishedAt || ""}`)
    .digest("hex")
    .slice(0, 8);

  return `${source.brandKey}-${slug || "deviantart"}-${hash}`;
}

function getArtworkKey(product) {
  return product?.sourceUrl || product?.source?.url || product?.link || product?.id;
}

function createProduct(source, item) {
  const artworkUrl = item.link || `https://www.deviantart.com/${source.username}`;
  const feedUrl = buildFeedUrl(source.username);

  return {
    id: createStableId(source, { ...item, link: artworkUrl }),
    title: item.title,
    category: source.category,
    type: source.type,
    price: source.price,
    image: item.image,
    link: source.defaultLink || artworkUrl,
    buttonText: source.buttonText,
    featured: source.featured,
    source: "deviantart",
    sourceUrl: artworkUrl,
    brand: source.brand,
    brandKey: source.brandKey,
    publishedAt: item.publishedAt,
    description: item.description || "",
    tags: item.tags || [],
    author: item.author || source.username,
    sourceUsername: source.username,
    sourceFeedUrl: feedUrl
  };
}

async function importSource(source) {
  const feedUrl = buildFeedUrl(source.username);
  const response = await fetch(feedUrl, {
    headers: {
      "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "HappyCreativeEcosystem/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`${source.username} RSS request failed with ${response.status}`);
  }

  const xml = await response.text();
  return parseItems(xml)
    .filter((item) => item.link)
    .slice(0, IMPORT_LIMIT)
    .map((item) => createProduct(source, item));
}

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This importer needs Node.js 18 or newer because it uses the built-in fetch API.");
  }

  const sources = await readJson(SOURCES_FILE, []);
  const existingProducts = await readJson(OUTPUT_FILE, []);
  const productMap = new Map();

  existingProducts.forEach((product) => {
    const key = getArtworkKey(product);
    if (key) productMap.set(key, product);
  });

  let importedCount = 0;
  let failureCount = 0;

  for (const source of sources) {
    try {
      const importedProducts = await importSource(source);
      importedProducts.forEach((product) => {
        const key = getArtworkKey(product);
        if (key) productMap.set(key, product);
      });
      importedCount += importedProducts.length;
      console.log(`Imported ${importedProducts.length} items from ${source.username}.`);
    } catch (error) {
      failureCount += 1;
      console.warn(`Could not import ${source.username}: ${error.message}`);
    }
  }

  const products = [...productMap.values()].sort((a, b) => {
    const dateA = Date.parse(a.publishedAt || "") || 0;
    const dateB = Date.parse(b.publishedAt || "") || 0;
    return dateB - dateA;
  });

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(products, null, 2)}\n`, "utf8");
  console.log(`Saved ${products.length} imported DeviantArt products to data/deviantart-products.json.`);

  if (failureCount > 0) {
    process.exitCode = 1;
  } else if (importedCount === 0) {
    console.log("No DeviantArt items were found in the configured RSS feeds.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
