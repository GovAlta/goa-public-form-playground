import type { EligibilityAnswers } from "../../lib/form-state";

/**
 * The screener's branching, as data. A graph rather than conditionals in the pages,
 * because three things walk it: moving forward, landing after a change from the
 * review page, and counting how many questions a change newly opened.
 */

export type StepId = "age" | "residency" | "otherSupport" | "otherSupportDetail";
export type Outcome = "review" | "ineligible";

export const NEXT: Record<StepId, (a: EligibilityAnswers) => StepId | Outcome> = {
  age: (a) => (a.age === "yes" ? "residency" : "ineligible"),
  residency: (a) => (a.residency === "yes" ? "otherSupport" : "ineligible"),
  otherSupport: (a) => (a.otherSupport === "yes" ? "otherSupportDetail" : "review"),
  otherSupportDetail: () => "review",
};

export const FIRST_STEP: StepId = "age";

export type StepConfig = {
  heading: string;
  requiredError: string;
  field: "yesno" | "text";
  previous: StepId | null;
};

export const STEPS: Record<StepId, StepConfig> = {
  age: {
    heading: "Are you 18 or older?",
    requiredError: "Select yes if you are 18 or older",
    field: "yesno",
    previous: null,
  },
  residency: {
    heading: "Do you live in Alberta?",
    requiredError: "Select yes if you live in Alberta",
    field: "yesno",
    previous: "age",
  },
  otherSupport: {
    heading: "Are you receiving support from another program?",
    requiredError: "Select yes if you are receiving support from another program",
    field: "yesno",
    previous: "residency",
  },
  otherSupportDetail: {
    heading: "Which program is supporting you?",
    requiredError: "Enter the name of the program",
    field: "text",
    previous: "otherSupport",
  },
};

export const STEP_IDS = Object.keys(STEPS) as StepId[];

export const isOutcome = (s: StepId | Outcome): s is Outcome =>
  s === "review" || s === "ineligible";

export const isAnswered = (id: StepId, a: EligibilityAnswers): boolean => {
  const value = a[id];
  return typeof value === "string" && value.trim() !== "";
};

/**
 * Walk forward, skipping answered questions, to the first unanswered one or an
 * outcome. Serves a first run and a change from the review page alike: the change
 * stops at whatever it newly opened, or goes straight back to review.
 */
export function resolveNext(
  from: StepId,
  a: EligibilityAnswers,
): { question: StepId } | { outcome: Outcome } {
  let cur = NEXT[from](a);
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) return { question: cur };
    cur = NEXT[cur](a);
  }
  return { outcome: cur };
}

export function reachable(a: EligibilityAnswers): Set<StepId> {
  const set = new Set<StepId>();
  let cur: StepId | Outcome = FIRST_STEP;
  while (!isOutcome(cur)) {
    set.add(cur);
    if (!isAnswered(cur, a)) break;
    cur = NEXT[cur](a);
  }
  return set;
}

/**
 * Where someone entering the section lands: the first unanswered question on the path
 * the answers actually open, or null when nothing is left (including failing a gate).
 * Walks the branches rather than the declared order, so a question the answers ruled
 * out is never mistaken for one still waiting. The caller sends null to /eligibility/check.
 */
export function firstUnansweredStep(a: EligibilityAnswers): StepId | null {
  let cur: StepId | Outcome = FIRST_STEP;
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) return cur;
    cur = NEXT[cur](a);
  }
  return null;
}

/**
 * Drop answers the current path no longer reaches, so a taken-back answer neither
 * shows on review nor comes back when the answer is flipped again.
 */
export function pruneUnreachable(a: EligibilityAnswers): EligibilityAnswers {
  const live = reachable(a);
  const pruned: EligibilityAnswers = {};
  for (const id of STEP_IDS) {
    if (live.has(id) && a[id] !== undefined) {
      // Each key's value type is its own; the cast keeps the loop generic.
      (pruned as Record<string, unknown>)[id] = a[id];
    }
  }
  return pruned;
}

export function remainingQuestions(from: StepId, a: EligibilityAnswers): number {
  let cur: StepId | Outcome = from;
  let n = 0;
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) n++;
    cur = NEXT[cur](a);
  }
  return n;
}

export function screenerOutcome(a: EligibilityAnswers): Outcome | null {
  let cur: StepId | Outcome = FIRST_STEP;
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) return null;
    cur = NEXT[cur](a);
  }
  return cur;
}
