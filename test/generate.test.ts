import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { generate } from "../src/main.js";

// Mock fs module
vi.mock("node:fs/promises");

describe("generate function", () => {
  const fixtureDir = "test/fixtures/www.gov-online.go.jp-2735fa68445b98e6";
  const testUrl = new URL("https://www.gov-online.go.jp/info/index.html");

  // Mock the fetch function
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should generate RSS from gov-online.go.jp fixtures", async () => {
    // Read actual fixture files for test data
    const realFs =
      await vi.importActual<typeof import("node:fs/promises")>(
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

    // Mock LAST file read (return null to process all items)
    mockReadFile.mockRejectedValueOnce({ code: "ENOENT" });

    // Mock directory creation
    mockMkdir.mockResolvedValue(undefined);

    // Mock RSS file write
    mockWriteFile.mockResolvedValue(undefined);

    // Run the generate function
    await generate(testUrl);

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

    // Verify that LAST file was written
    expect(mockWriteFile).toHaveBeenCalledWith("LAST", expect.any(String));
  });

  it("should handle fetch errors gracefully", async () => {
    // Mock fetch to throw an error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Mock fs operations
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockRejectedValueOnce({ code: "ENOENT" });

    // Expect the function to throw
    await expect(generate(testUrl)).rejects.toThrow("Network error");
  });
});
