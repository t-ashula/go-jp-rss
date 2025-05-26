import { describe, it, expect } from "vitest";
import { css, createCSSSelector } from "../src/types";

describe("CSS Selector Functions", () => {
  it("createCSSSelector should create a CSS selector from string", () => {
    const selector = createCSSSelector(".main");
    expect(selector).toBe(".main");
  });

  it("css tagged template literal should work with simple selector", () => {
    const selector = css`.main`;
    expect(selector).toBe(".main");
  });

  it("css tagged template literal should work with interpolated values", () => {
    const className = "main";
    const selector = css`.${className}`;
    expect(selector).toBe(".main");
  });

  it("css tagged template literal should work with complex selectors", () => {
    const className = "content";
    const id = "header";
    const selector = css`#${id} .${className} > p`;
    expect(selector).toBe("#header .content > p");
  });

  it("css and createCSSSelector should produce equivalent results", () => {
    const selector1 = createCSSSelector(".main");
    const selector2 = css`.main`;
    expect(selector1).toBe(selector2);
  });
});
