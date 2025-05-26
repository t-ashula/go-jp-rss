import type { NewsItem } from "./types.js";
import { logger, MAX_ITEMS } from "./config.js";

/**
 * Check if we should continue fetching more pages
 * @param items Current items
 * @param lastUrl Last processed URL
 * @param nextPageUrl Next page URL
 * @param oneWeekAgo Date one week ago
 * @returns Boolean indicating whether to continue
 */
export function shouldContinueFetching(
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
