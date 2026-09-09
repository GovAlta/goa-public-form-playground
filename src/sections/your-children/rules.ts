import type { ChildRecord } from "../../lib/form-state";
import {
  all,
  dateInThePast,
  required,
  runSchema,
  when,
  type Schema,
} from "../../lib/validation";

/**
 * Your children: a repeating group where each child is added by walking a short
 * sub-flow of pages (an answer changes the next question, so it cannot be a modal).
 * Structurally the screener scoped to one item. See docs/design-notes.md.
 */

export type ChildStepId =
  "name" | "date-of-birth" | "lives-with-you" | "living-arrangement";

/**
 * The end of one child's sub-flow. Named for the state rather than a page: adding a
 * child returns to the list, changing one returns to that child's check page.
 */
export type ChildOutcome = "done";

/** Every answer a child page collects. Derived, so a new field cannot be forgotten. */
export type ChildField = Exclude<keyof ChildRecord, "id">;

export type ChildStepConfig = {
  /** The page heading, built from the child so later questions say whose answer they collect. */
  heading: (child: ChildRecord) => string;
  fields: ChildField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

function shortName(child: ChildRecord): string {
  return child.firstName.trim() || "the child";
}

export const CHILD_STEPS: Record<ChildStepId, ChildStepConfig> = {
  name: {
    heading: () => "What is the child's name?",
    fields: ["firstName", "lastName"],
    schema: {
      firstName: required("Enter the child's first name"),
      lastName: required("Enter the child's last name"),
    },
  },

  "date-of-birth": {
    heading: (c) => `What is ${shortName(c)}'s date of birth?`,
    fields: ["dateOfBirth"],
    schema: {
      dateOfBirth: all(
        required("Enter the child's date of birth"),
        dateInThePast("Date of birth must be in the past"),
      ),
    },
  },

  "lives-with-you": {
    heading: (c) => `Does ${shortName(c)} live with you?`,
    fields: ["livesWithYou"],
    schema: {
      livesWithYou: required("Select yes if the child lives with you"),
    },
  },

  "living-arrangement": {
    heading: (c) => `Who does ${shortName(c)} live with?`,
    fields: ["livingArrangement"],
    schema: {
      // Conditional on the answer that opened it; without `when`, a child who lives
      // with the applicant could never finish the section.
      livingArrangement: when(
        (answers) => answers.livesWithYou === "no",
        required("Enter who the child lives with"),
      ),
    },
  },
};

export const CHILD_STEP_IDS = Object.keys(CHILD_STEPS) as ChildStepId[];

export const FIRST_CHILD_STEP: ChildStepId = CHILD_STEP_IDS[0];

export const isChildStep = (value: string | undefined): value is ChildStepId =>
  CHILD_STEP_IDS.includes(value as ChildStepId);

export const isChildOutcome = (step: ChildStepId | ChildOutcome): step is ChildOutcome =>
  step === "done";

/**
 * Where each question leads. A graph rather than conditionals in the pages, because
 * more than one thing walks it.
 */
export const NEXT_CHILD_STEP: Record<
  ChildStepId,
  (child: ChildRecord) => ChildStepId | ChildOutcome
> = {
  name: () => "date-of-birth",
  "date-of-birth": () => "lives-with-you",
  "lives-with-you": (c) => (c.livesWithYou === "no" ? "living-arrangement" : "done"),
  "living-arrangement": () => "done",
};

/**
 * A page is finished when its own rules pass. Off-path pages come back finished, since
 * their rules are conditional on the answer that would have opened them.
 */
export const isChildStepComplete = (id: ChildStepId, child: ChildRecord): boolean =>
  runSchema(CHILD_STEPS[id].schema, child as unknown as Record<string, unknown>)
    .length === 0;

/**
 * The questions on the path this child's answers describe. A step is recorded before
 * its answer is checked, so the page someone is standing on is always on the path.
 */
export function reachableChildSteps(child: ChildRecord): Set<ChildStepId> {
  const path = new Set<ChildStepId>();
  let cur: ChildStepId | ChildOutcome = FIRST_CHILD_STEP;
  while (!isChildOutcome(cur)) {
    path.add(cur);
    if (!isChildStepComplete(cur, child)) break;
    cur = NEXT_CHILD_STEP[cur](child);
  }
  return path;
}

/**
 * Walk forward, skipping answered questions, to the first unanswered one or the check
 * page. Serves a first run and a change from the check page alike: the change stops
 * at whatever it newly opened, or goes straight back.
 */
export function resolveNextChildStep(
  from: ChildStepId,
  child: ChildRecord,
): { question: ChildStepId } | { outcome: ChildOutcome } {
  let cur = NEXT_CHILD_STEP[from](child);
  while (!isChildOutcome(cur)) {
    if (!isChildStepComplete(cur, child)) return { question: cur };
    cur = NEXT_CHILD_STEP[cur](child);
  }
  return { outcome: cur };
}

/**
 * The page before this one along the path taken, so Back retraces the person's own
 * route. Null means nothing behind this page but the list.
 */
export function previousChildStep(
  step: ChildStepId,
  child: ChildRecord,
): ChildStepId | null {
  const path = [...reachableChildSteps(child)];
  const index = path.indexOf(step);
  return index > 0 ? path[index - 1] : null;
}

export function firstIncompleteChildStep(child: ChildRecord): ChildStepId | null {
  let cur: ChildStepId | ChildOutcome = FIRST_CHILD_STEP;
  while (!isChildOutcome(cur)) {
    if (!isChildStepComplete(cur, child)) return cur;
    cur = NEXT_CHILD_STEP[cur](child);
  }
  return null;
}

export const isChildComplete = (child: ChildRecord): boolean =>
  firstIncompleteChildStep(child) === null;

/**
 * Drop answers the current path no longer reaches, so a taken-back answer neither
 * shows on review nor reappears. Only on a fully walked child: pruning a half-answered
 * one would delete work already done.
 */
export function pruneChild(child: ChildRecord): ChildRecord {
  if (!isChildComplete(child)) return child;

  const live = reachableChildSteps(child);
  const pruned = { ...child };
  for (const id of CHILD_STEP_IDS) {
    if (live.has(id)) continue;
    for (const field of CHILD_STEPS[id].fields) {
      delete (pruned as Record<string, unknown>)[field];
    }
  }
  return pruned;
}

export function emptyChild(id: string): ChildRecord {
  return { id, firstName: "", lastName: "", dateOfBirth: "" };
}

/**
 * What a child is called in the list, the check page and the review page, named once
 * so they cannot disagree. The fallback is a real state: a child added and abandoned
 * before the name page still needs a row that can be finished or removed.
 */
export function childLabel(child: ChildRecord): string {
  const name = [child.firstName, child.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Child with no name yet";
}

/**
 * At least one child, and every one finished. Not a count: adding a child creates the
 * record immediately, so a row can still be unfinished work.
 */
export const childrenComplete = (children: ChildRecord[]): boolean =>
  children.length > 0 && children.every(isChildComplete);

/*
 * No field-to-page lookup here, unlike About you: a repeating group collapses on review
 * to each child's name with one Change back to the list, so nothing asks which page a
 * child's field lives on. See docs/design-notes.md.
 */
