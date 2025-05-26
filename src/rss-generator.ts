import { XMLBuilder } from "fast-xml-parser";
import type { NewsItem, MediaSettings } from "./types.js";
import { logger } from "./config.js";

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
 * Generate RSS XML from news items using media settings
 * @param items Array of news items
 * @param settings Media settings
 * @param targetUrl Target URL
 * @returns RSS XML string
 */
export function generateRss(
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
