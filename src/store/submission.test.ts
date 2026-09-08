import { describe, it, expect } from "vitest";
import { EMPTY_FORM } from "../lib/form-state";
import { submitApplication } from "./submission";

/**
 * The stand-in submit, tested for the one property that is a promise to the person
 * rather than an implementation detail: a reference they can read out over the phone
 * and type back in without losing anything.
 *
 * Note what these tests do NOT pin down: the prefix itself. It ships as ABC and every
 * fork is expected to change it, so asserting the literal string would hand a forking
 * team a failing test on day one for doing the right thing. A test in a template
 * should assert the contract a fork has to keep, not the values a fork will replace.
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
    // The prefix is stripped rather than measured. It is a fixed string a fork chooses,
    // so it says nothing about the generated alphabet, and this template's own ABC
    // would fail the check below on its B.
    const characters = new Set(drawn.flatMap((r) => body(r.reference).split("")));

    // The guard against passing for the wrong reason. If generation ever returned a
    // constant, or an empty string, the check below would be true of nothing at all
    // and this test would report success while measuring no letters. 200 draws over
    // a 25 character alphabet reach nearly all of it; 15 is a floor well clear of
    // chance and well under the real number.
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
