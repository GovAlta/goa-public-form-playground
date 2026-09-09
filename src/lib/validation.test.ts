import { describe, it, expect } from "vitest";
import {
  required,
  minSelected,
  pattern,
  when,
  all,
  optional,
  runSchema,
  type Schema,
} from "./validation";

describe("required", () => {
  it("rejects a string of only whitespace", () => {
    expect(required("Enter your name")("   ", {})).toBe("Enter your name");
  });

  it("accepts a string with content", () => {
    expect(required("Enter your name")("Ada", {})).toBeNull();
  });

  it("rejects an empty array, so an unchecked checkbox list fails", () => {
    expect(required("Choose at least one")([], {})).toBe("Choose at least one");
  });

  it("accepts a non-empty array", () => {
    expect(required("Choose at least one")(["a"], {})).toBeNull();
  });
});

describe("minSelected", () => {
  it("rejects fewer than the minimum", () => {
    expect(minSelected(2, "Choose two")(["a"], {})).toBe("Choose two");
  });

  it("accepts exactly the minimum", () => {
    expect(minSelected(2, "Choose two")(["a", "b"], {})).toBeNull();
  });

  it("rejects a non-array, rather than throwing", () => {
    expect(minSelected(1, "Choose one")(undefined, {})).toBe("Choose one");
  });
});

describe("pattern", () => {
  it("trims before testing, so a trailing space does not fail a valid answer", () => {
    const postal = pattern(/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, "Enter a valid postal code");
    expect(postal("T5J 2N9 ", {})).toBeNull();
  });

  it("rejects a value that does not match", () => {
    const postal = pattern(/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, "Enter a valid postal code");
    expect(postal("nope", {})).toBe("Enter a valid postal code");
  });
});

describe("when", () => {
  // A revealed question that is not showing must never block submission.
  it("skips the rule when the condition is false", () => {
    const rule = when((all) => all.hasOther === "yes", required("Say which"));
    expect(rule("", { hasOther: "no" })).toBeNull();
  });

  it("applies the rule when the condition is true", () => {
    const rule = when((all) => all.hasOther === "yes", required("Say which"));
    expect(rule("", { hasOther: "yes" })).toBe("Say which");
  });
});

describe("runSchema", () => {
  const schema: Schema = {
    firstName: required("Enter your first name"),
    lastName: required("Enter your last name"),
    postalCode: pattern(/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, "Enter a valid postal code"),
  };

  it("returns errors in declaration order, so the summary reads down the page", () => {
    const errors = runSchema(schema, { firstName: "", lastName: "", postalCode: "" });
    expect(errors.map((e) => e.fieldId)).toEqual(["firstName", "lastName", "postalCode"]);
  });

  it("returns an empty list when every rule passes", () => {
    const errors = runSchema(schema, {
      firstName: "Ada",
      lastName: "Lovelace",
      postalCode: "T5J 2N9",
    });
    expect(errors).toEqual([]);
  });

  it("reports only the fields that failed", () => {
    const errors = runSchema(schema, {
      firstName: "Ada",
      lastName: "",
      postalCode: "T5J 2N9",
    });
    expect(errors).toEqual([{ fieldId: "lastName", text: "Enter your last name" }]);
  });

  it("passes every value to each rule, so a rule can read its siblings", () => {
    const seen: Record<string, unknown>[] = [];
    runSchema({ a: (_v, all) => (seen.push(all), null) }, { a: 1, b: 2 });
    expect(seen[0]).toEqual({ a: 1, b: 2 });
  });
});

describe("all", () => {
  const postal = all(
    required("Enter your postal code"),
    pattern(/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, "Enter a postal code like T3R 8Y2"),
  );

  it("reports the missing message when nothing was entered, not the format one", () => {
    expect(postal("", {})).toBe("Enter your postal code");
  });

  it("reports the format message once something was entered", () => {
    expect(postal("nope", {})).toBe("Enter a postal code like T3R 8Y2");
  });

  it("accepts a value that passes every rule", () => {
    expect(postal("T3R 8Y2", {})).toBeNull();
  });

  it("stops at the first failure rather than collecting all of them", () => {
    const calls: string[] = [];
    const rule = all(
      () => (calls.push("first"), "failed here"),
      () => (calls.push("second"), null),
    );
    expect(rule("x", {})).toBe("failed here");
    expect(calls).toEqual(["first"]);
  });

  it("passes sibling values through to the rules it wraps", () => {
    const rule = all(when((values) => values.other === "yes", required("Needed")));
    expect(rule("", { other: "yes" })).toBe("Needed");
    expect(rule("", { other: "no" })).toBeNull();
  });
});

describe("optional", () => {
  const email = optional(pattern(/^\S+@\S+\.\S+$/, "Enter a valid email"));

  it("accepts an empty value, because nobody had to answer", () => {
    expect(email("", {})).toBeNull();
  });

  it("accepts whitespace as empty", () => {
    expect(email("   ", {})).toBeNull();
  });

  it("accepts an undefined value, which is how an untouched field arrives", () => {
    expect(email(undefined, {})).toBeNull();
  });

  it("still rejects an answer that was given but is unusable", () => {
    expect(email("ada@example", {})).toBe("Enter a valid email");
  });

  it("accepts a valid answer", () => {
    expect(email("ada@example.com", {})).toBeNull();
  });
});
