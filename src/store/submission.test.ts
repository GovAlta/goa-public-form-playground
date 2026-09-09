import { describe, it, expect } from "vitest";
import { EMPTY_FORM } from "../lib/form-state";
import { submitApplication } from "./submission";

/**
 * The reference's contract, not its prefix: ABC is a fork's to replace, so nothing here
 * pins it.
 */

const AMBIGUOUS = ["O", "0", "I", "1", "L", "S", "5", "B", "8", "Z", "2"];

/** Strips the service prefix and the group separators, whatever prefix a fork uses. */
const body = (reference: string): string => reference.replace(/^[A-Z]+-|-/g, "");

describe("the application reference", () => {
  it("comes back in three readable groups", async () => {
    const { reference } = await submitApplication(EMPTY_FORM);
    expect(reference).toMatch(/^[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("comes back with a timestamp of the moment it was accepted", async () => {
    const { submittedAt } = await submitApplication(EMPTY_FORM);
    expect(Number.isNaN(Date.parse(submittedAt))).toBe(false);
  });

  it("never uses a character that changes meaning when read aloud", async () => {
    const drawn = await Promise.all(
      Array.from({ length: 200 }, () => submitApplication(EMPTY_FORM)),
    );
    const characters = new Set(drawn.flatMap((r) => body(r.reference).split("")));

    // A floor, so a constant or empty reference cannot pass the loop below vacuously.
    expect(characters.size).toBeGreaterThan(15);

    for (const ambiguous of AMBIGUOUS) {
      expect(characters.has(ambiguous)).toBe(false);
    }
  });

  it("does not hand the same reference to two applications", async () => {
    const drawn = await Promise.all(
      Array.from({ length: 200 }, () => submitApplication(EMPTY_FORM)),
    );
    expect(new Set(drawn.map((r) => r.reference)).size).toBe(drawn.length);
  });
});
