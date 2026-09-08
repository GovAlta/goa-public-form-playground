import type { AboutYouAnswers } from "./form-state";
import {
  all,
  dateInThePast,
  optional,
  pattern,
  required,
  runSchema,
  type Rule,
  type Schema,
} from "./validation";

/**
 * The About you section: four pages, in order, with no branching.
 *
 * Compare lib/eligibility.ts, which is a graph. The difference is not stylistic. The
 * screener branches, so three separate things need to ask the flow questions about
 * itself and the flow has to be readable data. Nothing here branches, so the whole
 * "graph" is an ordered array and two index lookups.
 *
 * Building this as a graph too would work, and it would teach anyone forking this
 * template that a section needs one. It does not. The mechanism should follow the
 * shape of the questions.
 *
 * Where the page breaks fall is the other half of the same idea. Nothing forces a
 * split here, so each break has to earn itself: two questions share a page only when
 * you have to hold both in your head to answer either. You say a first and last name
 * in one breath and you recall an address whole, so those group. You do not need your
 * name in mind to remember your birthday, so that is its own page. Splitting is not a
 * cost to minimise: answering one thing and moving on is easier than holding four,
 * and a shorter page is a shorter validation cycle, so a failed submit sends you back
 * over less ground.
 */

export type AboutYouStepId = "name" | "date-of-birth" | "contact" | "address";

export type AboutYouField = keyof AboutYouAnswers;

export type AboutYouStepConfig = {
  /** The page heading, and the label the review page's Change link is understood by. */
  heading: string;
  /** The answers this page owns, in the order they appear on it. */
  fields: AboutYouField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

/* -------------------------------------------------------------------------- */
/* Rules that need more than a single check                                    */
/* -------------------------------------------------------------------------- */

/*
 * There is no "that is not a real date" rule here, and its absence is deliberate.
 *
 * The date control reports missing, partly filled and impossible dates as the same
 * empty value, so a page cannot tell them apart. Someone who fills in the day and the
 * year and forgets the month is told "Enter your date of birth" while looking at two
 * thirds of one. A rule for it would never run.
 *
 * The ceiling: granular date errors become possible when the picker exposes partial
 * input. Until then the aspiration belongs on the component issue, not in a branch
 * here that cannot execute — a template is read as an example, and dead validation
 * teaches every fork to write more of it.
 */

/**
 * Ten digits, or eleven starting with a country code. Everything else about the
 * input is forgiven: spaces, dashes, brackets and a leading +1 are all how people
 * actually write phone numbers, and rejecting them is rejecting a correct answer for
 * being punctuated.
 */
const phoneNumber: Rule = (v) => {
  const digits = (typeof v === "string" ? v : "").replace(/\D/g, "");
  const valid = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  return valid ? null : "Enter a phone number in the correct format, like 780 123 4567";
};

const POSTAL_CODE = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

/** Deliberately loose. The only way to know an address is deliverable is to send to it. */
const EMAIL = /^\S+@\S+\.\S+$/;

/* -------------------------------------------------------------------------- */
/* The four pages                                                              */
/* -------------------------------------------------------------------------- */

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
      // Optional, but an answered optional field still has to be usable. A typo'd
      // email nobody had to give is worse than no email: it looks like a way to
      // reach someone and silently is not.
      email: optional(
        pattern(EMAIL, "Enter an email address in the correct format, like name@example.com"),
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

/* -------------------------------------------------------------------------- */
/* Walking the section                                                         */
/* -------------------------------------------------------------------------- */

export const nextStep = (from: AboutYouStepId): AboutYouStepId | null =>
  ABOUT_YOU_STEP_IDS[ABOUT_YOU_STEP_IDS.indexOf(from) + 1] ?? null;

export const previousStep = (from: AboutYouStepId): AboutYouStepId | null =>
  ABOUT_YOU_STEP_IDS[ABOUT_YOU_STEP_IDS.indexOf(from) - 1] ?? null;

/**
 * A page is done when its own rules pass.
 *
 * Worth stating plainly, because the tempting alternative is a second list of which
 * answers are needed. There would then be two definitions of "finished" — the rules
 * the page enforces, and the list the task list reads — and the day someone makes a
 * field optional they will change one of them.
 */
export const isStepComplete = (id: AboutYouStepId, answers: AboutYouAnswers): boolean =>
  runSchema(ABOUT_YOU_STEPS[id].schema, answers as Record<string, unknown>).length === 0;

/**
 * The first page still needing work, or null when the section is finished.
 *
 * Null rather than a fallback page, which is the same contract the other three
 * walkers keep. "Nothing left" is a real answer and the caller has somewhere better
 * to send a finished section than back to its first question — its check page. A
 * walker that answered "nothing left" with "the first page" would make those two
 * cases indistinguishable to whoever calls it.
 */
export function firstIncompleteStep(answers: AboutYouAnswers): AboutYouStepId | null {
  return ABOUT_YOU_STEP_IDS.find((id) => !isStepComplete(id, answers)) ?? null;
}

/**
 * Which page a given answer is changed on.
 *
 * The review page needs this: a Change link beside a postal code has to land on the
 * page that asks for it. Deriving it from the same `fields` lists the pages are built
 * from is what stops the review page keeping its own quietly diverging copy.
 */
export function stepForField(field: AboutYouField): AboutYouStepId | null {
  return ABOUT_YOU_STEP_IDS.find((id) => ABOUT_YOU_STEPS[id].fields.includes(field)) ?? null;
}
