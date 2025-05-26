import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Medium, MediaSettings } from "./types.js";
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
async function loadMediaSettings(settingsPath: string): Promise<MediaSettings> {
  try {
    // Import the TypeScript settings file
    const settingsModule = await import(path.resolve(settingsPath));
    const settings = settingsModule.default;
    return settings;
  } catch (error) {
    logger.error({ error, settingsPath }, "Error loading media settings");
    throw error;
  }
}

/**
 * Load all media configurations from the media directory
 * @returns Array of Medium objects
 */
async function loadMediaConfigurations(): Promise<Medium[]> {
  const mediaDir = "media";
  const media: Medium[] = [];

  try {
    const entries = await fs.readdir(mediaDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mediaPath = path.join(mediaDir, entry.name);

        try {
          // Read URL file
          const urlContent = await fs.readFile(
            path.join(mediaPath, "URL"),
            "utf-8",
          );
          const url = new URL(urlContent.trim());

          // Read LAST file (optional)
          let last: string | null = null;
          try {
            const lastContent = await fs.readFile(
              path.join(mediaPath, "LAST"),
              "utf-8",
            );
            last = lastContent.trim();
          } catch {
            // LAST file doesn't exist, which is fine
          }

          // Read FETCHED_AT file (optional)
          let fetchedAt: Date | null = null;
          try {
            const fetchedAtContent = await fs.readFile(
              path.join(mediaPath, "FETCHED_AT"),
              "utf-8",
            );
            fetchedAt = new Date(fetchedAtContent.trim());
          } catch {
            // FETCHED_AT file doesn't exist, which is fine
          }

          // Load settings
          const settingsPath = path.join(mediaPath, "settings.ts");
          const settings = await loadMediaSettings(settingsPath);

          media.push({
            url,
            last,
            fetchedAt,
            settings,
            mediaPath,
          });

          logger.info(
            { url: url.toString(), mediaPath },
            "Loaded media configuration",
          );
        } catch (error) {
          logger.error(
            { error, mediaPath },
            "Failed to load media configuration",
          );
        }
      }
    }
  } catch (error) {
    logger.error({ error, mediaDir }, "Failed to read media directory");
  }

  return media;
}

export { loadMediaConfigurations, getMediaDirectoryName };
