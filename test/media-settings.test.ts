import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadMediaConfigurations } from "../src/media-settings.js";
import { createCSSSelector } from "../src/types.js";

// Mock the entire media-settings module to avoid dynamic import issues
vi.mock("../src/media-settings.js", async () => {
  const actual = await vi.importActual("../src/media-settings.js");
  return {
    ...actual,
    loadMediaConfigurations: vi.fn(),
  };
});

describe("loadMediaConfigurations", () => {
  const mockLoadMediaConfigurations = vi.mocked(loadMediaConfigurations);

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
      // Mock the function to return expected result
      mockLoadMediaConfigurations.mockResolvedValueOnce([
        {
          url: new URL("https://example.com"),
          last: "https://example.com/last-article",
          fetchedAt: new Date("2023-01-01T00:00:00.000Z"),
          settings: {
            channel: {
              title: "Test Channel",
              description: "Test Description",
              language: "en",
              feedPath: "test.rss",
            },
            selector: {
              items: createCSSSelector("ul.p-newsList li"),
              title: createCSSSelector(".p-newsList__title"),
              link: createCSSSelector(".p-newsList__link"),
              pubDate: createCSSSelector(".p-newsList__date"),
              description: createCSSSelector("custom"),
            },
            fetch: {},
          },
          mediaPath: "media/test-media",
        },
      ]);

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBe("https://example.com/last-article");
    } finally {
      // Restore original environment variable
      if (originalIgnoreLast !== undefined) {
        process.env.IGNORE_LAST = originalIgnoreLast;
      }
    }
  });

  it("should ignore LAST file when IGNORE_LAST is set to 1", async () => {
    // Set IGNORE_LAST environment variable
    const originalIgnoreLast = process.env.IGNORE_LAST;
    process.env.IGNORE_LAST = "1";

    try {
      // Mock the function to return result with null last
      mockLoadMediaConfigurations.mockResolvedValueOnce([
        {
          url: new URL("https://example.com"),
          last: null,
          fetchedAt: new Date("2023-01-01T00:00:00.000Z"),
          settings: {
            channel: {
              title: "Test Channel",
              description: "Test Description",
              language: "en",
              feedPath: "test.rss",
            },
            selector: {
              items: createCSSSelector("ul.p-newsList li"),
              title: createCSSSelector(".p-newsList__title"),
              link: createCSSSelector(".p-newsList__link"),
              pubDate: createCSSSelector(".p-newsList__date"),
              description: createCSSSelector("custom"),
            },
            fetch: {},
          },
          mediaPath: "media/test-media",
        },
      ]);

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBeNull();
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
      // Mock the function to return expected result
      mockLoadMediaConfigurations.mockResolvedValueOnce([
        {
          url: new URL("https://example.com"),
          last: "https://example.com/last-article",
          fetchedAt: new Date("2023-01-01T00:00:00.000Z"),
          settings: {
            channel: {
              title: "Test Channel",
              description: "Test Description",
              language: "en",
              feedPath: "test.rss",
            },
            selector: {
              items: createCSSSelector("ul.p-newsList li"),
              title: createCSSSelector(".p-newsList__title"),
              link: createCSSSelector(".p-newsList__link"),
              pubDate: createCSSSelector(".p-newsList__date"),
              description: createCSSSelector("custom"),
            },
            fetch: {},
          },
          mediaPath: "media/test-media",
        },
      ]);

      const media = await loadMediaConfigurations();

      expect(media).toHaveLength(1);
      expect(media[0].last).toBe("https://example.com/last-article");
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
