import fs from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import pino from "pino";

// Logger setup
const logger = pino({
  level: "info",
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Constants
const GOV_INFO_URL = "https://www.gov-online.go.jp/info/index.html";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
const RSS_FILE_PATH = path.join("feed", "www.gov-online.go.jp-info.rss");
const LAST_FILE_PATH = "LAST";
const MAX_ITEMS = 40;
const FETCH_TIMEOUT = 10000; // 10 seconds

// Types
interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

/**
 * Read the last processed URL from LAST file
 * @returns The last URL or null if file doesn't exist
 */
async function readLastUrl(): Promise<string | null> {
  try {
    const content = await fs.readFile(LAST_FILE_PATH, "utf-8");
    return content.trim();
  } catch (error) {
    // If file doesn't exist, return null
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.info("LAST file not found, will process up to MAX_ITEMS");
      return null;
    }
    // For other errors, log and rethrow
    logger.error({ error }, "Error reading LAST file");
    throw error;
  }
}

/**
 * Save the latest URL to LAST file
 * @param url The URL to save
 */
async function saveLastUrl(url: string): Promise<void> {
  try {
    await fs.writeFile(LAST_FILE_PATH, url);
    logger.info({ url }, "Saved latest URL to LAST file");
  } catch (error) {
    logger.error({ error, url }, "Error saving to LAST file");
    throw error;
  }
}

/**
 * Fetch HTML content from URL
 * @param url The URL to fetch
 * @returns The HTML content
 */
async function fetchHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    logger.error({ error, url }, "Error fetching HTML");
    throw error;
  }
}

/**
 * Parse HTML and extract news items
 * @param html The HTML content
 * @returns Array of news items
 */
function parseNewsItems(html: string): NewsItem[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const newsListItems = document.querySelectorAll("ul.p-newsList li");

  const items: NewsItem[] = [];

  newsListItems.forEach((item) => {
    const titleElement = item.querySelector(".p-newsList__title");
    const linkElement = item.querySelector(".p-newsList__link");
    const dateElement = item.querySelector(".p-newsList__date");
    const categoryElement = item.querySelector(".p-newsList__categoryLabel");

    if (titleElement && linkElement && dateElement && categoryElement) {
      const title = titleElement.textContent?.trim() || "";
      const link = linkElement.getAttribute("href") || "";
      const dateText = dateElement.textContent?.trim() || "";
      const category = categoryElement.textContent?.trim() || "";
      const dateTimeAttr = dateElement.getAttribute("datetime") || "";

      items.push({
        title,
        link,
        description: `${dateText} ${category} ${title}`,
        pubDate: dateTimeAttr,
      });
    }
  });

  return items;
}

/**
 * Check if we should continue fetching more pages
 * @param items Current items
 * @param lastUrl Last processed URL
 * @param nextPageUrl Next page URL
 * @returns Boolean indicating whether to continue
 */
function shouldContinueFetching(
  items: NewsItem[],
  lastUrl: string | null,
  nextPageUrl: string | null,
  oneWeekAgo: Date,
): boolean {
  // If there's no next page, stop
  if (!nextPageUrl) {
    logger.info("No next page URL found, stopping");
    return false;
  }

  // If we've reached the last URL, stop
  if (lastUrl && items.some((item) => item.link === lastUrl)) {
    logger.info({ lastUrl }, "Reached last processed URL, stopping");
    return false;
  }

  // If we've collected enough items and there's no last URL, stop
  if (!lastUrl && items.length >= MAX_ITEMS) {
    logger.info({ count: items.length }, "Reached maximum items, stopping");
    return false;
  }

  // Check if the latest item is older than one week
  const latestItem = items[items.length - 1];
  if (latestItem && latestItem.pubDate) {
    const itemDate = new Date(latestItem.pubDate);
    if (itemDate < oneWeekAgo) {
      logger.info({ itemDate }, "Items are older than one week, stopping");
      return false;
    }
  }

  return true;
}

/**
 * Generate RSS XML from news items
 * @param items Array of news items
 * @returns RSS XML string
 */
function generateRss(items: NewsItem[]): string {
  const rssItems = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${formatRssDate(item.pubDate)}</pubDate>
    </item>
  `,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>各府省の新着情報</title>
    <link>https://www.gov-online.go.jp/info/index.html</link>
    <description>各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。</description>
    <language>ja-JP</language>
    ${rssItems}
  </channel>
</rss>`;
}

/**
 * Escape XML special characters
 * @param str String to escape
 * @returns Escaped string
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format date for RSS
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns RFC 822 formatted date string
 */
function formatRssDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toUTCString();
  } catch {
    logger.warn({ dateStr }, "Error formatting date, using original");
    return dateStr;
  }
}

/**
 * Extract next page URL from HTML
 * @param html HTML content
 * @returns Next page URL or null
 */
function getNextPageUrl(html: string): string | null {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const nextPageLink = document.querySelector("div.p-pagination__next a");

  if (nextPageLink) {
    const href = nextPageLink.getAttribute("href");
    if (href) {
      // Convert relative URL to absolute
      if (href.startsWith("/")) {
        return `https://www.gov-online.go.jp${href}`;
      }
      return href;
    }
  }

  return null;
}

/**
 * Main function to fetch and process news
 */
async function main(): Promise<void> {
  try {
    // Read last processed URL
    const lastUrl = await readLastUrl();
    logger.info({ lastUrl }, "Starting process");

    let currentUrl = GOV_INFO_URL;
    let allItems: NewsItem[] = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch and process pages
    while (true) {
      logger.info({ url: currentUrl }, "Fetching page");

      // Fetch HTML
      const html = await fetchHtml(currentUrl);

      // Parse news items
      const items = parseNewsItems(html);
      if (items.length === 0) {
        logger.warn("No news items found on page, stopping");
        break;
      }

      // Add to collection
      allItems = [...allItems, ...items];

      // Get next page URL
      const nextPageUrl = getNextPageUrl(html);

      // Check if we should continue
      if (!shouldContinueFetching(allItems, lastUrl, nextPageUrl, oneWeekAgo)) {
        break;
      }

      // Update current URL for next iteration
      currentUrl = nextPageUrl as string;
    }

    // If we found items and have a last URL, filter out already processed items
    if (lastUrl && allItems.length > 0) {
      const lastUrlIndex = allItems.findIndex((item) => item.link === lastUrl);
      if (lastUrlIndex !== -1) {
        allItems = allItems.slice(0, lastUrlIndex);
      }
    }

    // Limit to MAX_ITEMS if needed
    if (allItems.length > MAX_ITEMS) {
      allItems = allItems.slice(0, MAX_ITEMS);
    }

    // If we have items, generate and save RSS
    if (allItems.length > 0) {
      logger.info({ count: allItems.length }, "Generating RSS");

      // Generate RSS
      const rss = generateRss(allItems);

      // Save RSS file
      await fs.mkdir(path.dirname(RSS_FILE_PATH), { recursive: true });
      await fs.writeFile(RSS_FILE_PATH, rss);
      logger.info({ path: RSS_FILE_PATH }, "RSS file saved");

      // Save latest URL to LAST file
      await saveLastUrl(allItems[0].link);
    } else {
      logger.info("No new items found");
    }

    logger.info("Process completed successfully");
  } catch (error) {
    logger.error({ error }, "Process failed");
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  logger.fatal({ error }, "Unhandled error in main");
  process.exit(1);
});
