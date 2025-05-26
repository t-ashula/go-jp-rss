import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { MediaSettings } from "./types.js";
import { logger } from "./config.js";

/**
 * Generate media directory name from URL
 * @param url Target URL
 * @returns Directory name in format: hostname-hash
 */
export function getMediaDirectoryName(url: URL): string {
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
export async function loadMediaSettings(url: URL): Promise<MediaSettings> {
  const dirName = getMediaDirectoryName(url);
  const settingsPath = path.join("media", dirName, "settings.json");

  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content) as MediaSettings;
  } catch (error) {
    logger.error({ error, settingsPath }, "Error loading media settings");
    throw error;
  }
}
