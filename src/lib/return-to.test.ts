import { describe, expect, it } from "vitest";
import { readReturnTo, withReturnTo, RETURN_LABELS, type ReturnTo } from "./return-to";

const params = (search: string) => new URLSearchParams(search);

describe("readReturnTo", () => {
  it("reads an origin the section supports", () => {
    expect(readReturnTo(params("?from=review"), ["review", "task"])).toBe("review");
    expect(readReturnTo(params("?from=task"), ["review", "task"])).toBe("task");
  });

  it("ignores an origin the section has no page for", () => {
    // Your children has no task-level check page; its list is that page.
    expect(readReturnTo(params("?from=task"), ["child"])).toBeNull();
  });

  it("ignores a value that is not an origin at all", () => {
    expect(readReturnTo(params("?from=/review"), ["review"])).toBeNull();
    expect(readReturnTo(params("?from=https://example.com"), ["review"])).toBeNull();
    expect(readReturnTo(params("?from="), ["review"])).toBeNull();
  });

  it("is null when there is no origin", () => {
    expect(readReturnTo(params(""), ["review", "task"])).toBeNull();
    expect(readReturnTo(params("?step=name"), ["review", "task"])).toBeNull();
  });
});

describe("withReturnTo", () => {
  it("adds the origin", () => {
    expect(withReturnTo("/about-you/name", "review")).toBe("/about-you/name?from=review");
    expect(withReturnTo("/about-you/name", "task")).toBe("/about-you/name?from=task");
  });

  it("leaves the path alone when there is no origin", () => {
    expect(withReturnTo("/about-you/name", null)).toBe("/about-you/name");
  });

  it("appends rather than starting a second query string", () => {
    // Nothing puts a second parameter on a question page yet; the day something does,
    // a naive ?from= would be unreadable.
    expect(withReturnTo("/documents/other-income?tab=2", "review")).toBe(
      "/documents/other-income?tab=2&from=review",
    );
  });

  it("round-trips through readReturnTo", () => {
    const origins: ReturnTo[] = ["review", "task", "child"];
    for (const origin of origins) {
      const url = new URL(withReturnTo("/x", origin), "https://example.test");
      expect(readReturnTo(url.searchParams, origins)).toBe(origin);
    }
  });
});

describe("RETURN_LABELS", () => {
  it("names every origin", () => {
    const origins: ReturnTo[] = ["review", "task", "child"];
    for (const origin of origins) {
      expect(RETURN_LABELS[origin]).toMatch(/^Back to /);
    }
  });
});
