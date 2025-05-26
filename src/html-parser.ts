import { JSDOM } from "jsdom";
import type { NewsItem, MediaSettings } from "./types.js";
import { logger, DEFAULT_USER_AGENT, DEFAULT_FETCH_TIMEOUT } from "./config.js";

/**
 * Fetch HTML content from URL using media settings
 * @param url The URL to fetch
 * @param settings Media settings
 * @returns The HTML content
 */
export async function fetchHtml(
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
export function parseNewsItems(
  html: string,
  settings: MediaSettings,
): NewsItem[] {
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
 * Extract next page URL from HTML using media settings
 * @param html HTML content
 * @param settings Media settings
 * @param currentUrl Current URL for resolving relative URLs
 * @returns Next page URL or null
 */
export function getNextPageUrl(
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
