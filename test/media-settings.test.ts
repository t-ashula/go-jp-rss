import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { loadMediaConfigurations } from "../src/media-settings.js";

// Mock fs module
vi.mock("node:fs/promises");

describe("loadMediaConfigurations", () => {
  const mockReaddir = vi.mocked(fs.readdir);
  const mockReadFile = vi.mocked(fs.readFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load LAST file when IGNORE_LAST is not set", async () => {
    // Ensure IGNORE_LAST is not set
    const originalIgnoreLast = process.env.IGNORE_LAST;
    process.env.IGNORE_LAST = undefined;

    try {
      // Mock directory listing
      mockReaddir.mockResolvedValueOnce([
        {
          name: "test-media",
          isDirectory: () => true,
        },
      ] as any);

      // Mock file reads
      mockReadFile
        .mockResolvedValueOnce("https://example.com") // URL file
        .mockResolvedValueOnce("https://example.com/last-article") // LAST file
        .mockResolvedValueOnce("2023-01-01T00:00:00.000Z"); // FETCHED_AT file

      // Mock dynamic import for settings
      vi.doMock("../media/test-media/settings.ts", () => ({
        default: {
          channel: {
            title: "Test Channel",
            description: "Test Description",
            language: "en",
            feedPath: "test.rss",
          },
          selector: {},
          fetch: {},
        },
      }));

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBe("https://example.com/last-article");
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("LAST"),
        "utf-8",
      );
    } finally {
      // Restore original environment variable
      if (originalIgnoreLast !== undefined) {
        process.env.IGNORE_LAST = originalIgnoreLast;
      } else {
        process.env.IGNORE_LAST = undefined;
      }
    }
  });

  it("should ignore LAST file when IGNORE_LAST is set to 1", async () => {
    // Set IGNORE_LAST environment variable
    const originalIgnoreLast = process.env.IGNORE_LAST;
    process.env.IGNORE_LAST = "1";

    try {
      // Mock directory listing
      mockReaddir.mockResolvedValueOnce([
        {
          name: "test-media",
          isDirectory: () => true,
        },
      ] as any);

      // Mock file reads - only URL and FETCHED_AT, no LAST file read
      mockReadFile
        .mockResolvedValueOnce("https://example.com") // URL file
        .mockResolvedValueOnce("2023-01-01T00:00:00.000Z"); // FETCHED_AT file

      // Mock dynamic import for settings
      vi.doMock("../media/test-media/settings.ts", () => ({
        default: {
          channel: {
            title: "Test Channel",
            description: "Test Description",
            language: "en",
            feedPath: "test.rss",
          },
          selector: {},
          fetch: {},
        },
      }));

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBeNull();

      // Verify LAST file was not read
      expect(mockReadFile).not.toHaveBeenCalledWith(
        expect.stringContaining("LAST"),
        "utf-8",
      );
    } finally {
      // Restore original environment variable
      if (originalIgnoreLast !== undefined) {
        process.env.IGNORE_LAST = originalIgnoreLast;
      } else {
        process.env.IGNORE_LAST = undefined;
      }
    }
  });

  it("should not ignore LAST file when IGNORE_LAST is set to value other than 1", async () => {
    // Set IGNORE_LAST environment variable to a different value
    const originalIgnoreLast = process.env.IGNORE_LAST;
    process.env.IGNORE_LAST = "0";

    try {
      // Mock directory listing
      mockReaddir.mockResolvedValueOnce([
        {
          name: "test-media",
          isDirectory: () => true,
        },
      ] as any);

      // Mock file reads
      mockReadFile
        .mockResolvedValueOnce("https://example.com") // URL file
        .mockResolvedValueOnce("https://example.com/last-article") // LAST file
        .mockResolvedValueOnce("2023-01-01T00:00:00.000Z"); // FETCHED_AT file

      // Mock dynamic import for settings
      vi.doMock("../media/test-media/settings.ts", () => ({
        default: {
          channel: {
            title: "Test Channel",
            description: "Test Description",
            language: "en",
            feedPath: "test.rss",
          },
          selector: {},
          fetch: {},
        },
      }));

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBe("https://example.com/last-article");
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("LAST"),
        "utf-8",
      );
    } finally {
      // Restore original environment variable
      if (originalIgnoreLast !== undefined) {
        process.env.IGNORE_LAST = originalIgnoreLast;
      } else {
        process.env.IGNORE_LAST = undefined;
      }
    }
  });
});
