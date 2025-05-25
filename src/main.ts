import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { JSDOM } from "jsdom";
import pino from "pino";
import { XMLBuilder } from "fast-xml-parser";

// Logger setup
const logger = pino({
  level: "info",
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Constants
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
const MAX_ITEMS = 40;
const DEFAULT_FETCH_TIMEOUT = 10000; // 10 seconds
const IGNORE_LAST = process.env.IGNORE_LAST === "1"; // If IGNORE_LAST=1, ignore LAST file

// Types
interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// Media settings types
type CSSSelector = string;

type ItemSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => Element[];
type TitleSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => string;
type LinkSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => URL;
type PubDateSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => Date;
type DescriptionSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => string;

type SelectorSettings = {
  items: CSSSelector | ItemSelectorFunc;
  title: CSSSelector | TitleSelectorFunc;
  link: CSSSelector | LinkSelectorFunc;
  pubDate: CSSSelector | PubDateSelectorFunc;
  description: CSSSelector | DescriptionSelectorFunc;
};

type NextPageSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => URL | null;

type FetchSettings = {
  userAgent?: string;
  timeout?: number;
  nextPageSelector?: CSSSelector | NextPageSelectorFunc;
};

type ChannelSettings = {
  title: string;
  description: string;
  language: string;
  feedPath: string;
};

interface MediaSettings {
  channel: ChannelSettings;
  selector: SelectorSettings;
  fetch?: FetchSettings;
}

/**
 * Generate media directory name from URL
 * @param url Target URL
 * @returns Directory name in format: hostname-hash
 */
function getMediaDirectoryName(url: URL): string {
  const hostname = url.hostname;
  const hash = crypto
    .createHash("sha256")
    .update(url.toString())
    .digest("hex")
    .substring(0, 16);
  return `${hostname}-${hash}`;
}

/**
 * Load media settings from directory
 * @param url Target URL
 * @returns Media settings
 */
async function loadMediaSettings(url: URL): Promise<MediaSettings> {
  const dirName = getMediaDirectoryName(url);
  const settingsPath = path.join("media", dirName, "settings.json");

  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content) as MediaSettings;
  } catch (error) {
    logger.error({ error, settingsPath }, "Error loading media settings");
    throw error;
  }
}

/**
 * Read the last processed URL from media directory
 * @param url Target URL
 * @returns The last URL or null if file doesn't exist
 */
async function readLastUrl(url: URL): Promise<string | null> {
  // If IGNORE_LAST is true, return null to process all items
  if (IGNORE_LAST) {
    logger.info("IGNORE_LAST is set, will process up to MAX_ITEMS");
    return null;
  }

  const dirName = getMediaDirectoryName(url);
  const lastFilePath = path.join("media", dirName, "LAST");

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
 * Save the latest URL to LAST file in media directory
 * @param targetUrl Target URL for media directory
 * @param lastUrl The URL to save
 */
async function saveLastUrl(targetUrl: URL, lastUrl: string): Promise<void> {
  // If IGNORE_LAST is true, don't save the last URL
  if (IGNORE_LAST) {
    logger.info({ lastUrl }, "IGNORE_LAST is set, not saving URL to LAST file");
    return;
  }

  const dirName = getMediaDirectoryName(targetUrl);
  const lastFilePath = path.join("media", dirName, "LAST");

  try {
    await fs.writeFile(lastFilePath, lastUrl);
    logger.info({ lastUrl }, "Saved latest URL to LAST file");
  } catch (error) {
    logger.error({ error, lastUrl }, "Error saving to LAST file");
    throw error;
  }
}

/**
 * Fetch HTML content from URL using media settings
 * @param url The URL to fetch
 * @param settings Media settings
 * @returns The HTML content
 */
async function fetchHtml(
  url: string,
  settings: MediaSettings,
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = settings.fetch?.timeout ?? DEFAULT_FETCH_TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const userAgent = settings.fetch?.userAgent ?? DEFAULT_USER_AGENT;
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
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
 * Parse HTML and extract news items using media settings
 * @param html The HTML content
 * @param settings Media settings
 * @returns Array of news items
 */
function parseNewsItems(html: string, settings: MediaSettings): NewsItem[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Get items using selector
  let newsListItems: Element[];
  if (typeof settings.selector.items === "string") {
    newsListItems = [...document.querySelectorAll(settings.selector.items)];
  } else {
    newsListItems = settings.selector.items(dom, settings);
  }

  const items: NewsItem[] = newsListItems.map((item) => {
    // Extract title
    let title = "";
    if (typeof settings.selector.title === "string") {
      const titleElement = item.querySelector(settings.selector.title);
      title = titleElement?.textContent?.trim() ?? "";
    } else {
      title = settings.selector.title(dom, settings);
    }

    // Extract link
    let link = "";
    if (typeof settings.selector.link === "string") {
      const linkElement = item.querySelector(settings.selector.link);
      link = linkElement?.getAttribute("href") ?? "";
    } else {
      const linkUrl = settings.selector.link(dom, settings);
      link = linkUrl.toString();
    }

    // Extract pubDate
    let pubDate = "";
    if (typeof settings.selector.pubDate === "string") {
      const dateElement = item.querySelector(settings.selector.pubDate);
      pubDate = dateElement?.getAttribute("datetime") ?? "";
    } else {
      const date = settings.selector.pubDate(dom, settings);
      pubDate = date.toISOString();
    }

    // Extract description
    let description = "";
    if (typeof settings.selector.description === "string") {
      if (settings.selector.description === "custom") {
        // For gov-online.go.jp custom description logic
        const dateElement = item.querySelector(".p-newsList__date");
        const categoryElement = item.querySelector(
          ".p-newsList__categoryLabel",
        );
        const dateText = dateElement?.textContent?.trim() ?? "";
        const category = categoryElement?.textContent?.trim() ?? "";
        description = `${dateText} ${category} ${title}`;
      } else {
        const descElement = item.querySelector(settings.selector.description);
        description = descElement?.textContent?.trim() ?? "";
      }
    } else {
      description = settings.selector.description(dom, settings);
    }

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
 * Generate RSS XML from news items using media settings
 * @param items Array of news items
 * @param settings Media settings
 * @param targetUrl Target URL
 * @returns RSS XML string
 */
function generateRss(
  items: NewsItem[],
  settings: MediaSettings,
  targetUrl: URL,
): string {
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
        title: settings.channel.title,
        link: targetUrl.toString(),
        description: settings.channel.description,
        language: settings.channel.language,
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
 * Extract next page URL from HTML using media settings
 * @param html HTML content
 * @param settings Media settings
 * @param currentUrl Current URL for resolving relative URLs
 * @returns Next page URL or null
 */
function getNextPageUrl(
  html: string,
  settings: MediaSettings,
  currentUrl: URL,
): string | null {
  if (!settings.fetch?.nextPageSelector) {
    return null;
  }

  const dom = new JSDOM(html);

  if (typeof settings.fetch.nextPageSelector === "string") {
    const document = dom.window.document;
    const nextPageLink = document.querySelector(
      settings.fetch.nextPageSelector,
    );

    if (nextPageLink) {
      const href = nextPageLink.getAttribute("href");
      if (href) {
        // Convert relative URL to absolute
        if (href.startsWith("/")) {
          return `${currentUrl.protocol}//${currentUrl.host}${href}`;
        }
        return href;
      }
    }
  } else {
    const nextUrl = settings.fetch.nextPageSelector(dom, settings);
    return nextUrl ? nextUrl.toString() : null;
  }

  return null;
}

/**
 * Generate RSS for a specific URL using media settings
 * @param url Target URL to process
 */
export async function generate(url: URL): Promise<void> {
  // Load media settings
  const settings = await loadMediaSettings(url);

  // Read last processed URL
  const rssFilePath = path.join("feed", settings.channel.feedPath);
  const lastUrl = await readLastUrl(url);
  logger.info({ lastUrl, targetUrl: url.toString() }, "Starting process");

  let currentUrl = url.toString();
  let allItems: NewsItem[] = [];
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Fetch and process pages
  while (true) {
    logger.info({ url: currentUrl }, "Fetching page");

    // Fetch HTML
    const html = await fetchHtml(currentUrl, settings);

    // Parse news items
    const items = parseNewsItems(html, settings);
    if (items.length === 0) {
      logger.warn("No news items found on page, stopping");
      break;
    }

    // Add to collection
    allItems = [...allItems, ...items];

    // Get next page URL
    const nextPageUrl = getNextPageUrl(html, settings, new URL(currentUrl));

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
    const rss = generateRss(allItems, settings, url);

    // Save RSS file
    await fs.mkdir(path.dirname(rssFilePath), { recursive: true });
    await fs.writeFile(rssFilePath, rss);
    logger.info({ path: rssFilePath }, "RSS file saved");

    // Save latest URL to LAST file
    await saveLastUrl(url, allItems[0].link);
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
