import type { JSDOM } from "jsdom";

// News item interface
export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// Media settings types
export type CSSSelector = string;

export type ItemSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => Element[];
export type TitleSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => string;
export type LinkSelectorFunc = (jsdom: JSDOM, settings: MediaSettings) => URL;
export type PubDateSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => Date;
export type DescriptionSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => string;

export type SelectorSettings = {
  items: CSSSelector | ItemSelectorFunc;
  title: CSSSelector | TitleSelectorFunc;
  link: CSSSelector | LinkSelectorFunc;
  pubDate: CSSSelector | PubDateSelectorFunc;
  description: CSSSelector | DescriptionSelectorFunc;
};

export type NextPageSelectorFunc = (
  jsdom: JSDOM,
  settings: MediaSettings,
) => URL | null;

export type FetchSettings = {
  userAgent?: string;
  timeout?: number;
  nextPageSelector?: CSSSelector | NextPageSelectorFunc;
};

export type ChannelSettings = {
  title: string;
  description: string;
  language: string;
  feedPath: string;
};

export interface MediaSettings {
  channel: ChannelSettings;
  selector: SelectorSettings;
  fetch?: FetchSettings;
}
