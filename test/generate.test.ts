import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { generate } from "../src/main.js";
import { createCSSSelector } from "../src/types.js";

// Mock fs module
vi.mock("node:fs/promises");

describe("generate function", () => {
  const fixtureDir = "test/fixtures/www.gov-online.go.jp-2735fa68445b98e6";
  const testUrl = new URL("https://www.gov-online.go.jp/info/index.html");

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
    const mockReadFile = vi.mocked(fs.readFile);
    const mockWriteFile = vi.mocked(fs.writeFile);
    const mockMkdir = vi.mocked(fs.mkdir);

    // Mock settings.json read
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(mockSettings)) // settings.json
      .mockRejectedValueOnce({ code: "ENOENT" }); // LAST file (not found)

    // Mock directory creation
    mockMkdir.mockResolvedValue(undefined);

    // Mock RSS file write
    mockWriteFile.mockResolvedValue(undefined);

    // Run the generate function
    await generate(testUrl);

    // Verify that settings.json was read
    expect(mockReadFile).toHaveBeenCalledWith(
      "media/www.gov-online.go.jp-2735fa68445b98e6/settings.json",
      "utf-8",
    );

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
    // Mock fs operations
    const mockReadFile = vi.mocked(fs.readFile);

    // Mock settings.json read first, then LAST file read (not found)
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(mockSettings)) // settings.json
      .mockRejectedValueOnce({ code: "ENOENT" }); // LAST file (not found)

    // Mock fetch to throw an error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Expect the function to throw
    await expect(generate(testUrl)).rejects.toThrow("Network error");
  });
});
