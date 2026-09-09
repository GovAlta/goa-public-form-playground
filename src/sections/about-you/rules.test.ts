import { describe, it, expect } from "vitest";
import { runSchema } from "../../lib/validation";
import type { AboutYouAnswers } from "../../lib/form-state";
import {
  ABOUT_YOU_STEPS,
  ABOUT_YOU_STEP_IDS,
  FIRST_ABOUT_YOU_STEP,
  firstIncompleteStep,
  isAboutYouStep,
  isStepComplete,
  nextStep,
  previousStep,
  stepForField,
  type AboutYouStepId,
} from "./rules";

const COMPLETE: AboutYouAnswers = {
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1985-03-27",
  phone: "780 123 4567",
  email: "ada@example.com",
  street: "10155 102 Street NW",
  suite: "1200",
  city: "Edmonton",
  province: "AB",
  postalCode: "T5J 4L4",
};

const errorsFor = (step: AboutYouStepId, answers: AboutYouAnswers) =>
  runSchema(ABOUT_YOU_STEPS[step].schema, answers as Record<string, unknown>).map(
    (e) => e.text,
  );

describe("the section's shape", () => {
  it("is four pages in order", () => {
    expect(ABOUT_YOU_STEP_IDS).toEqual(["name", "date-of-birth", "contact", "address"]);
  });

  it("starts at the first of them", () => {
    expect(FIRST_ABOUT_YOU_STEP).toBe("name");
  });

  it("walks forward and stops at the end rather than wrapping", () => {
    expect(nextStep("name")).toBe("date-of-birth");
    expect(nextStep("contact")).toBe("address");
    expect(nextStep("address")).toBeNull();
  });

  it("walks back and stops at the start rather than wrapping", () => {
    expect(previousStep("address")).toBe("contact");
    expect(previousStep("name")).toBeNull();
  });

  it("recognises its own step ids and refuses anything else", () => {
    expect(isAboutYouStep("contact")).toBe(true);
    expect(isAboutYouStep("nonsense")).toBe(false);
    expect(isAboutYouStep(undefined)).toBe(false);
  });

  it("claims every answer in the state shape exactly once, so nothing is unreachable", () => {
    const claimed = ABOUT_YOU_STEP_IDS.flatMap((id) => ABOUT_YOU_STEPS[id].fields);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(new Set(claimed)).toEqual(new Set(Object.keys(COMPLETE)));
  });
});

describe("stepForField", () => {
  it("finds the page a review Change link has to land on", () => {
    expect(stepForField("postalCode")).toBe("address");
    expect(stepForField("dateOfBirth")).toBe("date-of-birth");
    expect(stepForField("email")).toBe("contact");
  });
});

describe("what counts as finished", () => {
  it("counts every page as done when everything is answered", () => {
    for (const id of ABOUT_YOU_STEP_IDS) {
      expect(isStepComplete(id, COMPLETE)).toBe(true);
    }
  });

  it("counts a page as unfinished when one of its required answers is missing", () => {
    expect(isStepComplete("name", { ...COMPLETE, lastName: "" })).toBe(false);
  });

  it("still counts a page as done when only its optional answer is missing", () => {
    expect(isStepComplete("contact", { ...COMPLETE, email: undefined })).toBe(true);
  });

  it("does not let one page's missing answer mark another page unfinished", () => {
    const noAddress = { ...COMPLETE, street: "" };
    expect(isStepComplete("address", noAddress)).toBe(false);
    expect(isStepComplete("name", noAddress)).toBe(true);
  });
});

describe("firstIncompleteStep", () => {
  it("sends someone starting the section to the first page", () => {
    expect(firstIncompleteStep({})).toBe("name");
  });

  it("skips the pages already answered", () => {
    expect(firstIncompleteStep({ firstName: "Ada", lastName: "Lovelace" })).toBe(
      "date-of-birth",
    );
  });

  it("does not stop at a page whose only gap is optional", () => {
    const noEmail = { ...COMPLETE, email: undefined, street: "" };
    expect(firstIncompleteStep(noEmail)).toBe("address");
  });

  it("is null when there is nothing left to finish", () => {
    // Null rather than the first page: a finished section is sent to its check page.
    expect(firstIncompleteStep(COMPLETE)).toBeNull();
  });
});

describe("name", () => {
  it("asks for both parts", () => {
    expect(errorsFor("name", {})).toEqual([
      "Enter your first name",
      "Enter your last name",
    ]);
  });

  it("reports errors in the order the fields appear, so the summary reads top to bottom", () => {
    expect(errorsFor("name", { lastName: "Lovelace" })).toEqual([
      "Enter your first name",
    ]);
  });
});

describe("date of birth", () => {
  it("asks for it when nothing was entered", () => {
    expect(errorsFor("date-of-birth", {})).toEqual(["Enter your date of birth"]);
  });

  // No "not a real date" case: the control reports missing, partial and impossible
  // dates as the same empty value, so such a rule could never run.
  it("says only that it is missing when the control reports nothing", () => {
    expect(errorsFor("date-of-birth", { dateOfBirth: "" })).toEqual([
      "Enter your date of birth",
    ]);
  });

  it("gives one message for one mistake", () => {
    expect(errorsFor("date-of-birth", {})).toHaveLength(1);
  });

  it("rejects a date in the future", () => {
    expect(errorsFor("date-of-birth", { dateOfBirth: "3000-01-01" })).toEqual([
      "Date of birth must be in the past",
    ]);
  });

  it("accepts today, because being born today is not being born in the future", () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    expect(errorsFor("date-of-birth", { dateOfBirth: today })).toEqual([]);
  });

  it("accepts a real date in the past", () => {
    expect(errorsFor("date-of-birth", { dateOfBirth: "1985-03-27" })).toEqual([]);
  });

  // A date control may hand back a full timestamp; that is a correctly answered question.
  it("accepts a date carrying a time portion", () => {
    expect(
      errorsFor("date-of-birth", { dateOfBirth: "1985-03-27T00:00:00.000Z" }),
    ).toEqual([]);
  });

  it("does not read today-with-a-time as being in the future", () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    expect(errorsFor("date-of-birth", { dateOfBirth: `${today}T23:59:59.000Z` })).toEqual(
      [],
    );
  });

  it("accepts 29 February in a leap year", () => {
    expect(errorsFor("date-of-birth", { dateOfBirth: "1984-02-29" })).toEqual([]);
  });
});

describe("contact", () => {
  const contactErrors = (answers: AboutYouAnswers) => errorsFor("contact", answers);

  it("asks for a phone number when there is none", () => {
    expect(contactErrors({})).toEqual(["Enter your phone number"]);
  });

  it("forgives how people actually punctuate a phone number", () => {
    for (const written of [
      "780 123 4567",
      "780-123-4567",
      "(780) 123-4567",
      "+1 780 123 4567",
    ]) {
      expect(contactErrors({ phone: written })).toEqual([]);
    }
  });

  it("rejects a number with too few digits", () => {
    expect(contactErrors({ phone: "780 123" })).toEqual([
      "Enter a phone number in the correct format, like 780 123 4567",
    ]);
  });

  it("lets the email be left out entirely", () => {
    expect(contactErrors({ phone: "780 123 4567" })).toEqual([]);
  });

  it("rejects an email that was given but cannot be delivered to", () => {
    expect(contactErrors({ phone: "780 123 4567", email: "ada@example" })).toEqual([
      "Enter an email address in the correct format, like name@example.com",
    ]);
  });
});

describe("address", () => {
  it("asks for every required part, in field order", () => {
    expect(errorsFor("address", {})).toEqual([
      "Enter your street address",
      "Enter your city or town",
      "Select your province or territory",
      "Enter your postal code",
    ]);
  });

  it("says the postal code is missing rather than that it is malformed", () => {
    expect(errorsFor("address", { ...COMPLETE, postalCode: "" })).toEqual([
      "Enter your postal code",
    ]);
  });

  it("says the postal code is malformed once something was entered", () => {
    expect(errorsFor("address", { ...COMPLETE, postalCode: "12345" })).toEqual([
      "Enter a postal code in the correct format, like T3R 8Y2",
    ]);
  });

  it("accepts a postal code with or without the space, and in either case", () => {
    for (const written of ["T5J 4L4", "T5J4L4", "t5j 4l4"]) {
      expect(errorsFor("address", { ...COMPLETE, postalCode: written })).toEqual([]);
    }
  });

  it("never requires the suite, because not every address has one", () => {
    expect(errorsFor("address", { ...COMPLETE, suite: undefined })).toEqual([]);
  });
});
