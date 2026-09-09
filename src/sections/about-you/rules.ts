import type { AboutYouAnswers } from "../../lib/form-state";
import {
  all,
  dateInThePast,
  optional,
  pattern,
  required,
  runSchema,
  type Rule,
  type Schema,
} from "../../lib/validation";

/**
 * The About you section: four pages, in order, no branching. An ordered array rather
 * than a graph like src/sections/eligibility/rules.ts, because nothing here branches. Two questions
 * share a page only when you need both in mind to answer either; the page-splitting
 * rule is in docs/design-notes.md.
 */

export type AboutYouStepId = "name" | "date-of-birth" | "contact" | "address";

export type AboutYouField = keyof AboutYouAnswers;

export type AboutYouStepConfig = {
  heading: string;
  fields: AboutYouField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

/*
 * No "not a real date" rule, deliberately: the date control reports missing, partial
 * and impossible dates as the same empty value, so such a rule could never run.
 */

/**
 * Ten digits, or eleven starting with a country code. Spaces, dashes, brackets and a
 * leading +1 are how people write phone numbers, not errors.
 */
const phoneNumber: Rule = (v) => {
  const digits = (typeof v === "string" ? v : "").replace(/\D/g, "");
  const valid = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  return valid ? null : "Enter a phone number in the correct format, like 780 123 4567";
};

const POSTAL_CODE = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

/** Deliberately loose. The only way to know an address is deliverable is to send to it. */
const EMAIL = /^\S+@\S+\.\S+$/;

export const ABOUT_YOU_STEPS: Record<AboutYouStepId, AboutYouStepConfig> = {
  name: {
    heading: "What is your name?",
    fields: ["firstName", "lastName"],
    schema: {
      firstName: required("Enter your first name"),
      lastName: required("Enter your last name"),
    },
  },

  "date-of-birth": {
    heading: "What is your date of birth?",
    fields: ["dateOfBirth"],
    schema: {
      dateOfBirth: all(
        required("Enter your date of birth"),
        dateInThePast("Date of birth must be in the past"),
      ),
    },
  },

  contact: {
    heading: "How can we contact you?",
    fields: ["phone", "email"],
    schema: {
      phone: all(required("Enter your phone number"), phoneNumber),
      // Optional, but a typo'd email nobody had to give is worse than none.
      email: optional(
        pattern(
          EMAIL,
          "Enter an email address in the correct format, like name@example.com",
        ),
      ),
    },
  },

  address: {
    heading: "What is your address?",
    fields: ["street", "suite", "city", "province", "postalCode"],
    schema: {
      street: required("Enter your street address"),
      city: required("Enter your city or town"),
      province: required("Select your province or territory"),
      postalCode: all(
        required("Enter your postal code"),
        pattern(POSTAL_CODE, "Enter a postal code in the correct format, like T3R 8Y2"),
      ),
    },
  },
};

export const ABOUT_YOU_STEP_IDS = Object.keys(ABOUT_YOU_STEPS) as AboutYouStepId[];

export const FIRST_ABOUT_YOU_STEP: AboutYouStepId = ABOUT_YOU_STEP_IDS[0];

export const isAboutYouStep = (value: string | undefined): value is AboutYouStepId =>
  ABOUT_YOU_STEP_IDS.includes(value as AboutYouStepId);

export const nextStep = (from: AboutYouStepId): AboutYouStepId | null =>
  ABOUT_YOU_STEP_IDS[ABOUT_YOU_STEP_IDS.indexOf(from) + 1] ?? null;

export const previousStep = (from: AboutYouStepId): AboutYouStepId | null =>
  ABOUT_YOU_STEP_IDS[ABOUT_YOU_STEP_IDS.indexOf(from) - 1] ?? null;

/**
 * A page is done when its own rules pass. One definition of finished, rather than a
 * second list of required answers that would drift from the rules.
 */
export const isStepComplete = (id: AboutYouStepId, answers: AboutYouAnswers): boolean =>
  runSchema(ABOUT_YOU_STEPS[id].schema, answers as Record<string, unknown>).length === 0;

/**
 * The first page still needing work, or null when the section is finished. Null
 * rather than a fallback page: the caller sends a finished section to its check page.
 */
export function firstIncompleteStep(answers: AboutYouAnswers): AboutYouStepId | null {
  return ABOUT_YOU_STEP_IDS.find((id) => !isStepComplete(id, answers)) ?? null;
}

/**
 * Which page an answer is changed on, for the review page's Change links. Derived
 * from the same `fields` lists the pages use, so the review page has no diverging copy.
 */
export function stepForField(field: AboutYouField): AboutYouStepId | null {
  return (
    ABOUT_YOU_STEP_IDS.find((id) => ABOUT_YOU_STEPS[id].fields.includes(field)) ?? null
  );
}
