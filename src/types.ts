import type { JSDOM } from "jsdom";

// News item interface
interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// Media settings types
// Branded type for CSS selectors to ensure type safety
type CSSSelector = string & { readonly __brand: "CSSSelector" };

// Helper function to create a CSSSelector from a string
const createCSSSelector = (selector: string): CSSSelector => {
  return selector as CSSSelector;
};

// Tagged template literal function for CSS selectors
const css = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): CSSSelector => {
  const selector = strings.reduce((result, string, i) => {
    return result + string + (values[i] || "");
  }, "");
  return selector as CSSSelector;
};

// Type guard function to check if a value is a CSSSelector
const isCSSSelector = (value: unknown): value is CSSSelector => {
  return typeof value === "string"; // TODO: runtime check
};

type ItemSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => Element[];

type SelectorFunc<T> = (
  item: Element,
  jsdom: JSDOM,
  settings: MediaSettings,
) => T;

type TitleSelectorFunc = SelectorFunc<string>;
type LinkSelectorFunc = SelectorFunc<URL>;
type PubDateSelectorFunc = SelectorFunc<Date>;
type DescriptionSelectorFunc = SelectorFunc<string>;

type SelectorSettings = {
  items: CSSSelector | ItemSelectorFunc;
  title: CSSSelector | TitleSelectorFunc;
  link: CSSSelector | LinkSelectorFunc;
  pubDate: CSSSelector | PubDateSelectorFunc;
  description: CSSSelector | DescriptionSelectorFunc;
};

type NextPageSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => URL | null;

type FetchSettings = {
  userAgent?: string;
  timeout?: number;
  nextPageSelector?: CSSSelector | NextPageSelectorFunc;
};

type ChannelSettings = {
  title: string;
  description: string;
  language: string;
  feedPath: string;
};

interface MediaSettings {
  channel: ChannelSettings;
  selector: SelectorSettings;
  fetch?: FetchSettings;
}

// Medium interface for handling multiple media sources
interface Medium {
  url: URL;
  last: string | null;
  fetchedAt: Date | null;
  settings: MediaSettings;
  mediaPath: string;
}

export type {
  NewsItem,
  CSSSelector,
  ItemSelectorFunc,
  SelectorFunc,
  TitleSelectorFunc,
  LinkSelectorFunc,
  PubDateSelectorFunc,
  DescriptionSelectorFunc,
  SelectorSettings,
  NextPageSelectorFunc,
  FetchSettings,
  ChannelSettings,
  MediaSettings,
  Medium,
};

export { createCSSSelector, isCSSSelector, css };
