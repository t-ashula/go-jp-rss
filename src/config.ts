import pino from "pino";

// Constants
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
export const MAX_ITEMS = 40;
export const DEFAULT_FETCH_TIMEOUT = 10000; // 10 seconds
export const IGNORE_LAST = process.env.IGNORE_LAST === "1"; // If IGNORE_LAST=1, ignore LAST file

// Logger setup
export const logger = pino({
  level: "info",
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});
