import fs from "node:fs/promises";
import path from "node:path";
import type { NewsItem } from "./types.js";
import { logger, MAX_ITEMS } from "./config.js";
import { loadMediaSettings } from "./media-settings.js";
import { readLastUrl, saveLastUrl } from "./file-operations.js";
import { fetchHtml, parseNewsItems, getNextPageUrl } from "./html-parser.js";
import { generateRss } from "./rss-generator.js";
import { shouldContinueFetching } from "./fetch-utils.js";

/**
 * Generate RSS for a specific URL using media settings
 * @param url Target URL to process
 */
async function generate(url: URL): Promise<void> {
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
async function main(): Promise<void> {
  try {
    const govInfoUrl = new URL("https://www.gov-online.go.jp/info/index.html");
    await generate(govInfoUrl);
  } catch (error) {
    logger.error({ error }, "Process failed");
    process.exit(1);
  }
}

export { generate, main };
