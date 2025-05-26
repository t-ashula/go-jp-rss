import type { MediaSettings } from "../../src/types.js";
import { createCSSSelector } from "../../src/types.js";

// Media settings for www.gov-online.go.jp
const settings: Omit<MediaSettings, "targetUrl"> = {
  channel: {
    title: "各府省の新着情報",
    description:
      "各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。",
    language: "ja-JP",
    feedPath: "www.gov-online.go.jp-info.rss",
  },
  selector: {
    items: createCSSSelector("ul.p-newsList li"),
    title: createCSSSelector(".p-newsList__title"),
    link: createCSSSelector(".p-newsList__link"),
    pubDate: createCSSSelector(".p-newsList__date"),
    description: createCSSSelector("custom"), // Custom function will be handled by the loader
  },
  fetch: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36",
    timeout: 10000,
    nextPageSelector: createCSSSelector("div.p-pagination__next a"),
  },
};

export default settings;
