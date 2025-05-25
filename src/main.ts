import fs from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import pino from "pino";
import { XMLBuilder } from "fast-xml-parser";

// Logger setup
const logger = pino({
  level: "info",
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Constants
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
const MAX_ITEMS = 40;
const FETCH_TIMEOUT = 10000; // 10 seconds
const IGNORE_LAST = process.env.IGNORE_LAST === "1"; // If IGNORE_LAST=1, ignore LAST file

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
async function readLastUrl(lastFilePath: string): Promise<string | null> {
  // If IGNORE_LAST is true, return null to process all items
  if (IGNORE_LAST) {
    logger.info("IGNORE_LAST is set, will process up to MAX_ITEMS");
    return null;
  }

  try {
    const content = await fs.readFile(lastFilePath, "utf-8");
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
async function saveLastUrl(url: string, lastFilePath: string): Promise<void> {
  // If IGNORE_LAST is true, don't save the last URL
  if (IGNORE_LAST) {
    logger.info({ url }, "IGNORE_LAST is set, not saving URL to LAST file");
    return;
  }

  try {
    await fs.writeFile(lastFilePath, url);
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

  const items: NewsItem[] = [...newsListItems].map((item) => {
    const titleElement = item.querySelector(".p-newsList__title");
    const linkElement = item.querySelector(".p-newsList__link");
    const dateElement = item.querySelector(".p-newsList__date");
    const categoryElement = item.querySelector(".p-newsList__categoryLabel");

    const title = titleElement?.textContent?.trim() ?? "";
    const link = linkElement?.getAttribute("href") ?? "";
    const dateText = dateElement?.textContent?.trim() ?? "";
    const category = categoryElement?.textContent?.trim() ?? "";
    const pubDate = dateElement?.getAttribute("datetime") ?? "";

    const description = `${dateText} ${category} ${title}`;

    return {
      title,
      link,
      description,
      pubDate,
    };
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
  if (latestItem?.pubDate) {
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
  // XMLBuilder のオプション設定
  const options = {
    ignoreAttributes: false,
    format: true,
    indentBy: "  ",
    suppressEmptyNode: false,
  };

  const builder = new XMLBuilder(options);

  const rssObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    rss: {
      "@_version": "2.0",
      channel: {
        title: "各府省の新着情報",
        link: "https://www.gov-online.go.jp/info/index.html",
        description:
          "各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。",
        language: "ja-JP",
        item: items.map((item) => ({
          title: item.title,
          link: item.link,
          description: item.description,
          pubDate: formatRssDate(item.pubDate),
        })),
      },
    },
  };

  return builder.build(rssObj);
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
 * Generate RSS for a specific URL
 * @param url Target URL to process
 */
export async function generate(url: URL): Promise<void> {
  // Read last processed URL
  const rssFilePath = path.join("feed", "www.gov-online.go.jp-info.rss");
  const lastFilePath = "LAST";

  const lastUrl = await readLastUrl(lastFilePath);
  logger.info({ lastUrl, targetUrl: url.toString() }, "Starting process");

  let currentUrl = url.toString();
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
    await fs.mkdir(path.dirname(rssFilePath), { recursive: true });
    await fs.writeFile(rssFilePath, rss);
    logger.info({ path: rssFilePath }, "RSS file saved");

    // Save latest URL to LAST file
    await saveLastUrl(allItems[0].link, lastFilePath);
  } else {
    logger.info("No new items found");
  }

  logger.info("Process completed successfully");
}

/**
 * Main function to fetch and process news
 */
export async function main(): Promise<void> {
  try {
    const govInfoUrl = new URL("https://www.gov-online.go.jp/info/index.html");
    await generate(govInfoUrl);
  } catch (error) {
    logger.error({ error }, "Process failed");
    process.exit(1);
  }
}
