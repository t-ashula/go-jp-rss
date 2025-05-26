import { JSDOM } from "jsdom";
import type { NewsItem, MediaSettings } from "./types.js";
import { isCSSSelector } from "./types.js";
import { logger, DEFAULT_USER_AGENT, DEFAULT_FETCH_TIMEOUT } from "./config.js";

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
  if (isCSSSelector(settings.selector.items)) {
    newsListItems = [...document.querySelectorAll(settings.selector.items)];
  } else {
    newsListItems = settings.selector.items(dom, settings);
  }

  const items: NewsItem[] = newsListItems.map((item) => {
    // Extract title
    let title = "";
    if (isCSSSelector(settings.selector.title)) {
      const titleElement = item.querySelector(settings.selector.title);
      title = titleElement?.textContent?.trim() ?? "";
    } else {
      title = settings.selector.title(item, dom, settings);
    }

    // Extract link
    let link = "";
    if (isCSSSelector(settings.selector.link)) {
      const linkElement = item.querySelector(settings.selector.link);
      link = linkElement?.getAttribute("href") ?? "";
    } else {
      const linkUrl = settings.selector.link(item, dom, settings);
      link = linkUrl.toString();
    }

    // Extract pubDate
    let pubDate = "";
    if (isCSSSelector(settings.selector.pubDate)) {
      const dateElement = item.querySelector(settings.selector.pubDate);
      pubDate = dateElement?.getAttribute("datetime") ?? "";
    } else {
      const date = settings.selector.pubDate(item, dom, settings);
      pubDate = date.toISOString();
    }

    // Extract description
    let description = "";
    if (isCSSSelector(settings.selector.description)) {
      const descElement = item.querySelector(settings.selector.description);
      description = descElement?.textContent?.trim() ?? "";
    } else {
      description = settings.selector.description(item, dom, settings);
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
function getNextPageUrl(
  html: string,
  settings: MediaSettings,
  currentUrl: URL,
): string | null {
  if (!settings.fetch?.nextPageSelector) {
    return null;
  }

  const dom = new JSDOM(html);

  if (isCSSSelector(settings.fetch.nextPageSelector)) {
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

export { fetchHtml, parseNewsItems, getNextPageUrl };
