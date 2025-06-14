import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { generate } from "../src/main.js";
import { createCSSSelector, type Medium } from "../src/types.js";

// Mock fs module
vi.mock("node:fs/promises");

describe("generate function", () => {
  const fixtureDir = "test/fixtures/www.gov-online.go.jp-2735fa68445b98e6";
  const testUrl = new URL("https://www.gov-online.go.jp/info/index.html");

  // Create test medium object
  const createTestMedium = (): Medium => ({
    url: testUrl,
    last: null,
    fetchedAt: null,
    settings: {
      ...mockSettings,
    },
    mediaPath: "media/www.gov-online.go.jp-2735fa68445b98e6",
  });

  // Mock the fetch function
  const mockFetch = vi.fn();

  // Mock settings.json content
  const mockSettings = {
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
      description: createCSSSelector("custom"),
    },
    fetch: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36",
      timeout: 10000,
      nextPageSelector: createCSSSelector("div.p-pagination__next a"),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should generate RSS from gov-online.go.jp fixtures", async () => {
    // Read actual fixture files for test data
    const realFs = await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
    const html0 = await realFs.readFile(
      path.join(fixtureDir, "0.html"),
      "utf-8",
    );
    const html1 = await realFs.readFile(
      path.join(fixtureDir, "1.html"),
      "utf-8",
    );

    // Mock fetch responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html0),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html1),
      });

    // Mock fs operations
    const mockWriteFile = vi.mocked(fs.writeFile);
    const mockMkdir = vi.mocked(fs.mkdir);

    // Mock directory creation
    mockMkdir.mockResolvedValue(undefined);

    // Mock RSS file write
    mockWriteFile.mockResolvedValue(undefined);

    // Run the generate function
    await generate(createTestMedium());

    // Verify that fetch was called with correct URLs
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.gov-online.go.jp/info/index.html",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("Mozilla"),
        }),
      }),
    );

    // Verify that RSS file was written
    expect(mockWriteFile).toHaveBeenCalledWith(
      "feed/www.gov-online.go.jp-info.rss",
      expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>'),
    );

    // Verify that LAST file was written to media directory
    expect(mockWriteFile).toHaveBeenCalledWith(
      "media/www.gov-online.go.jp-2735fa68445b98e6/LAST",
      expect.any(String),
    );
  });

  it("should handle fetch errors gracefully", async () => {
    // Mock fetch to throw an error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Expect the function to throw
    await expect(generate(createTestMedium())).rejects.toThrow("Network error");
  });

  it("should ignore LAST value when IGNORE_LAST environment variable is set to 1", async () => {
    // Set environment variable
    const originalIgnoreLast = process.env.IGNORE_LAST;
    process.env.IGNORE_LAST = "1";

    try {
      // Read actual fixture files for test data
      const realFs = await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
      const html0 = await realFs.readFile(
        path.join(fixtureDir, "0.html"),
        "utf-8",
      );

      // Mock fetch responses - limit to prevent infinite loop
      let fetchCallCount = 0;
      mockFetch.mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount <= 2) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(html0),
          });
        }
        // Return HTML without next page link to stop pagination
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve("<html><body>No more pages</body></html>"),
        });
      });

      // Mock fs operations
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockMkdir = vi.mocked(fs.mkdir);

      // Mock directory creation
      mockMkdir.mockResolvedValue(undefined);

      // Mock RSS file write
      mockWriteFile.mockResolvedValue(undefined);

      // Create test medium with a last URL that would normally stop processing
      const mediumWithLast = createTestMedium();
      mediumWithLast.last =
        "https://www.gov-online.go.jp/info/some-old-article.html";

      // Run the generate function
      await generate(mediumWithLast);

      // Verify that RSS file was still written (meaning LAST was ignored)
      expect(mockWriteFile).toHaveBeenCalledWith(
        "feed/www.gov-online.go.jp-info.rss",
        expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>'),
      );

      // Verify that LAST file was written to media directory
      expect(mockWriteFile).toHaveBeenCalledWith(
        "media/www.gov-online.go.jp-2735fa68445b98e6/LAST",
        expect.any(String),
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
