import fs from "node:fs/promises";
import path from "node:path";
import { getMediaDirectoryName } from "./media-settings.js";
import { logger, IGNORE_LAST } from "./config.js";

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

export { readLastUrl, saveLastUrl };
