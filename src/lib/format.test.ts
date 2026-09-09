import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatYesNo,
  formatPhone,
  formatFileSize,
  formatList,
  formatAddressLines,
} from "./format";

describe("formatDate", () => {
  it("writes a stored date the way a person reads it", () => {
    expect(formatDate("1990-01-01")).toBe("1 January 1990");
  });

  it("drops the leading zero from the day", () => {
    expect(formatDate("2024-03-07")).toBe("7 March 2024");
  });

  // new Date("1990-01-01") is midnight UTC, which is 31 December 1989 in Alberta.
  it("does not shift the date backwards in a timezone behind UTC", () => {
    expect(formatDate("1990-01-01")).not.toContain("December");
    expect(formatDate("1990-01-01")).not.toContain("1989");
  });

  it("handles the last day of a year, where an off-by-one is most visible", () => {
    expect(formatDate("1999-12-31")).toBe("31 December 1999");
  });

  it("ignores a time portion if one is present", () => {
    expect(formatDate("2024-03-07T14:30:00Z")).toBe("7 March 2024");
  });

  it("returns empty for a missing value rather than the word undefined", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("hands back anything it cannot parse, rather than inventing a date", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("hands back an impossible month rather than showing undefined", () => {
    expect(formatDate("2024-13-01")).toBe("2024-13-01");
  });
});

describe("formatYesNo", () => {
  it("capitalises a stored answer", () => {
    expect(formatYesNo("yes")).toBe("Yes");
    expect(formatYesNo("no")).toBe("No");
  });

  it("returns empty for an unanswered question", () => {
    expect(formatYesNo(undefined)).toBe("");
  });
});

describe("formatPhone", () => {
  it("spaces out ten digits", () => {
    expect(formatPhone("7801234567")).toBe("780 123 4567");
  });

  it("normalises a number someone typed with punctuation", () => {
    expect(formatPhone("(780) 123-4567")).toBe("780 123 4567");
  });

  it("leaves anything that is not ten digits alone rather than mangling it", () => {
    expect(formatPhone("123")).toBe("123");
  });
});

describe("formatFileSize", () => {
  it("uses bytes below a kilobyte", () => {
    expect(formatFileSize(512)).toBe("512 bytes");
  });

  it("uses whole kilobytes in the middle range", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
  });

  it("uses one decimal for megabytes", () => {
    expect(formatFileSize(2_516_582)).toBe("2.4 MB");
  });
});

describe("formatList", () => {
  it("joins the last item with and", () => {
    expect(formatList(["a", "b", "c"])).toBe("a, b and c");
  });

  it("leaves a single item alone", () => {
    expect(formatList(["a"])).toBe("a");
  });

  it("drops blanks so an empty answer does not leave a dangling comma", () => {
    expect(formatList(["a", "", "c"])).toBe("a and c");
  });

  it("returns empty for nothing at all", () => {
    expect(formatList([])).toBe("");
  });
});

describe("formatAddressLines", () => {
  it("puts city and province on one line and the postal code on its own", () => {
    expect(
      formatAddressLines({
        street: "123 Main Street",
        city: "Edmonton",
        province: "Alberta",
        postalCode: "T5J 2N9",
      }),
    ).toEqual(["123 Main Street", "Edmonton, Alberta", "T5J 2N9"]);
  });

  // Canada Post puts the unit ahead of the street number on the same line.
  it("joins a suite to the street line rather than giving it its own", () => {
    expect(
      formatAddressLines({
        street: "10155 102 Street NW",
        suite: "1200",
        city: "Edmonton",
        province: "Alberta",
        postalCode: "T5J 4L4",
      }),
    ).toEqual(["1200-10155 102 Street NW", "Edmonton, Alberta", "T5J 4L4"]);
  });

  it("leaves the street line alone when there is no suite", () => {
    expect(formatAddressLines({ street: "123 Main Street", suite: "" })).toEqual([
      "123 Main Street",
    ]);
  });

  it("does not leave a dangling separator when a suite arrives without a street", () => {
    expect(formatAddressLines({ suite: "1200", city: "Edmonton" })).toEqual([
      "1200",
      "Edmonton",
    ]);
  });

  it("omits missing parts instead of leaving blank lines", () => {
    expect(formatAddressLines({ street: "123 Main Street", city: "Edmonton" })).toEqual([
      "123 Main Street",
      "Edmonton",
    ]);
  });

  it("returns nothing for an empty address", () => {
    expect(formatAddressLines({})).toEqual([]);
  });
});
