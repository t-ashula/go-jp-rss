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

type ItemSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => Element[];
type TitleSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => string;
type LinkSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => URL;
type PubDateSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => Date;
type DescriptionSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => string;

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
  targetUrl: URL;
  channel: ChannelSettings;
  selector: SelectorSettings;
  fetch?: FetchSettings;
}

export type {
  NewsItem,
  CSSSelector,
  ItemSelectorFunc,
  TitleSelectorFunc,
  LinkSelectorFunc,
  PubDateSelectorFunc,
  DescriptionSelectorFunc,
  SelectorSettings,
  NextPageSelectorFunc,
  FetchSettings,
  ChannelSettings,
  MediaSettings,
};

export { createCSSSelector };
