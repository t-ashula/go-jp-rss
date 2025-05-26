import path from "node:path";
import crypto from "node:crypto";
import type { MediaSettings } from "./types.js";
import { logger } from "./config.js";

/**
 * Generate media directory name from URL
 * @param url Target URL
 * @returns Directory name in format: hostname-hash
 */
function getMediaDirectoryName(url: URL): string {
  const hostname = url.hostname;
  const hash = crypto
    .createHash("sha256")
    .update(url.toString())
    .digest("hex")
    .substring(0, 16);
  return `${hostname}-${hash}`;
}

/**
 * Load media settings from directory
 * @param url Target URL
 * @returns Media settings
 */
async function loadMediaSettings(url: URL): Promise<MediaSettings> {
  const dirName = getMediaDirectoryName(url);
  const settingsPath = path.join("media", dirName, "settings.ts");

  try {
    // Import the TypeScript settings file
    const settingsModule = await import(path.resolve(settingsPath));
    const rawSettings = settingsModule.default;

    // Create the complete MediaSettings object with targetUrl
    const settings: MediaSettings = {
      ...rawSettings,
      targetUrl: url,
    };

    return settings;
  } catch (error) {
    logger.error({ error, settingsPath }, "Error loading media settings");
    throw error;
  }
}

export { getMediaDirectoryName, loadMediaSettings };
