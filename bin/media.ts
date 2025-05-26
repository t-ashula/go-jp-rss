#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { getMediaDirectoryName } from "../src/media-settings.js";

/**
 * Generate default settings.ts content for a given URL
 * @param url Target URL
 * @returns Default settings.ts content
 */
function generateDefaultSettings(url: URL): string {
  const hostname = url.hostname;
  const title = `RSS Feed for ${hostname}`;
  const feedPath = `${hostname}.rss`;

  return `import type {
  MediaSettings,
  DescriptionSelectorFunc,
} from "../../src/types.js";
import { css } from "../../src/types.js";

// Custom description selector function for ${hostname}
const descriptionSelectorFunc: DescriptionSelectorFunc = (
  item,
  _jsdom,
  _settings,
) => {
  // Extract text content from the item
  const textContent = item.textContent?.trim() ?? "";
  return textContent;
};

// Media settings for ${hostname}
const settings: MediaSettings = {
  channel: {
    title: "${title}",
    description: "RSS feed generated from ${url.toString()}",
    language: "ja-JP",
    feedPath: "${feedPath}",
  },
  selector: {
    items: css\`/* TODO: Set appropriate CSS selector for items */\`,
    title: css\`/* TODO: Set appropriate CSS selector for title */\`,
    link: css\`/* TODO: Set appropriate CSS selector for link */\`,
    pubDate: css\`/* TODO: Set appropriate CSS selector for publication date */\`,
    description: descriptionSelectorFunc,
  },
  fetch: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36",
    timeout: 10000,
    nextPageSelector: css\`/* TODO: Set appropriate CSS selector for next page link if needed */\`,
  },
};

export default settings;
`;
}

/**
 * Main function to create or display media settings
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: tsx bin/media.ts <URL>");
    process.exit(1);
  }

  const urlString = args[0];
  let url: URL;

  try {
    url = new URL(urlString);
  } catch (_error) {
    console.error(`Invalid URL: ${urlString}`);
    process.exit(1);
  }

  const mediaDir = "media";
  const directoryName = getMediaDirectoryName(url);
  const mediaPath = path.join(mediaDir, directoryName);
  const settingsPath = path.join(mediaPath, "settings.ts");
  const urlFilePath = path.join(mediaPath, "URL");

  try {
    // Check if the media directory already exists
    await fs.access(mediaPath);

    // Directory exists, display the existing settings.ts
    console.log(`Media settings already exist for ${url.toString()}`);
    console.log(`Directory: ${mediaPath}`);
    console.log("\nExisting settings.ts:");
    console.log("=".repeat(50));

    try {
      const settingsContent = await fs.readFile(settingsPath, "utf-8");
      console.log(settingsContent);
    } catch (error) {
      console.error(`Error reading settings.ts: ${error}`);
    }
  } catch (_error) {
    // Directory doesn't exist, create it and generate files
    console.log(`Creating new media settings for ${url.toString()}`);
    console.log(`Directory: ${mediaPath}`);

    try {
      // Create the media directory
      await fs.mkdir(mediaPath, { recursive: true });

      // Write URL file
      await fs.writeFile(urlFilePath, url.toString());

      // Generate and write settings.ts
      const settingsContent = generateDefaultSettings(url);
      await fs.writeFile(settingsPath, settingsContent);

      console.log("\nGenerated settings.ts:");
      console.log("=".repeat(50));
      console.log(settingsContent);

      console.log(`\nFiles created successfully in ${mediaPath}`);
      console.log("- URL");
      console.log("- settings.ts");
      console.log(
        "\nPlease edit settings.ts to configure appropriate CSS selectors for your target website.",
      );
    } catch (createError) {
      console.error(`Error creating media settings: ${createError}`);
      process.exit(1);
    }
  }
}

// Run the main function
main().catch((error) => {
  console.error(`Unexpected error: ${error}`);
  process.exit(1);
});
