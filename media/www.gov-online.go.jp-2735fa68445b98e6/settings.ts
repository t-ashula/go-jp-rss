import type { MediaSettings } from "../../src/types.js";
import { css } from "../../src/types.js";

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
    items: css`ul.p-newsList li`,
    title: css`.p-newsList__title`,
    link: css`.p-newsList__link`,
    pubDate: css`.p-newsList__date`,
    description: css`custom`, // Custom function will be handled by the loader
  },
  fetch: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36",
    timeout: 10000,
    nextPageSelector: css`div.p-pagination__next a`,
  },
};

export default settings;
