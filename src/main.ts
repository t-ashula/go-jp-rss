import fs from "node:fs/promises";
import path from "node:path";
import type { NewsItem, Medium } from "./types.js";
import { logger, MAX_ITEMS } from "./config.js";
import { loadMediaSettings } from "./media-settings.js";
import { fetchHtml, parseNewsItems, getNextPageUrl } from "./html-parser.js";
import { generateRss } from "./rss-generator.js";
import { shouldContinueFetching } from "./fetch-utils.js";

/**
 * Load all media configurations from the media directory
 * @returns Array of Medium objects
 */
async function loadMediaConfigurations(): Promise<Medium[]> {
  const mediaDir = "media";
  const media: Medium[] = [];

  try {
    const entries = await fs.readdir(mediaDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mediaPath = path.join(mediaDir, entry.name);

        try {
          // Read URL file
          const urlContent = await fs.readFile(
            path.join(mediaPath, "URL"),
            "utf-8",
          );
          const url = new URL(urlContent.trim());

          // Read LAST file (optional)
          let last: string | null = null;
          try {
            const lastContent = await fs.readFile(
              path.join(mediaPath, "LAST"),
              "utf-8",
            );
            last = lastContent.trim();
          } catch {
            // LAST file doesn't exist, which is fine
          }

          // Read FETCHED_AT file (optional)
          let fetchedAt: Date | null = null;
          try {
            const fetchedAtContent = await fs.readFile(
              path.join(mediaPath, "FETCHED_AT"),
              "utf-8",
            );
            fetchedAt = new Date(fetchedAtContent.trim());
          } catch {
            // FETCHED_AT file doesn't exist, which is fine
          }

          // Load settings
          const settings = await loadMediaSettings(url);

          media.push({
            url,
            last,
            fetchedAt,
            settings,
            mediaPath,
          });

          logger.info(
            { url: url.toString(), mediaPath },
            "Loaded media configuration",
          );
        } catch (error) {
          logger.error(
            { error, mediaPath },
            "Failed to load media configuration",
          );
        }
      }
    }
  } catch (error) {
    logger.error({ error, mediaDir }, "Failed to read media directory");
  }

  return media;
}

/**
 * Generate RSS for a specific medium
 * @param medium Medium object containing URL and settings
 */
async function generate(medium: Medium): Promise<void> {
  const { url, settings } = medium;

  // Read last processed URL
  const rssFilePath = path.join("feed", settings.channel.feedPath);
  const lastUrl = medium.last;
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
    const lastFilePath = path.join(medium.mediaPath, "LAST");
    await fs.writeFile(lastFilePath, allItems[0].link);

    // Update FETCHED_AT file
    const fetchedAtPath = path.join(medium.mediaPath, "FETCHED_AT");
    await fs.writeFile(fetchedAtPath, new Date().toISOString());
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
    // Load all media configurations
    const media = await loadMediaConfigurations();

    if (media.length === 0) {
      logger.warn("No media configurations found");
      return;
    }

    logger.info({ count: media.length }, "Processing media configurations");

    // Process each medium
    for (const medium of media) {
      try {
        logger.info({ url: medium.url.toString() }, "Processing medium");
        await generate(medium);
      } catch (error) {
        logger.error(
          { error, url: medium.url.toString() },
          "Failed to process medium",
        );
        // Continue with next medium instead of exiting
      }
    }

    logger.info("All media processing completed");
  } catch (error) {
    logger.error({ error }, "Process failed");
    process.exit(1);
  }
}

export { generate, main };
