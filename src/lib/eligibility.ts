import type { EligibilityAnswers } from "./form-state";

/**
 * The screener's branching, as data.
 *
 * The branch logic is a graph rather than a chain of conditionals inside the pages,
 * because three separate things need to walk it: moving forward through the
 * questions, working out where a person lands after changing an answer on the review
 * page, and counting how many questions a change has newly opened up.
 *
 * Conditionals in JSX can only serve the first of those. The moment someone can go
 * back and change an answer, you need to be able to ask the flow questions about
 * itself, and that means the flow has to be something you can read rather than
 * something you can only execute.
 *
 * Nothing here imports React. A screener is a fact about the service.
 */

export type StepId = "age" | "residency" | "otherSupport" | "otherSupportDetail";
export type Outcome = "review" | "ineligible";

/** Where each step leads, given the answers so far. */
export const NEXT: Record<StepId, (a: EligibilityAnswers) => StepId | Outcome> = {
  age: (a) => (a.age === "yes" ? "residency" : "ineligible"),
  residency: (a) => (a.residency === "yes" ? "otherSupport" : "ineligible"),
  otherSupport: (a) => (a.otherSupport === "yes" ? "otherSupportDetail" : "review"),
  otherSupportDetail: () => "review",
};

export const FIRST_STEP: StepId = "age";

export type StepConfig = {
  /** The question, which is also the page heading. */
  heading: string;
  /** Shown when the question is left unanswered. */
  requiredError: string;
  field: "yesno" | "text";
  /** The step before this one, for the back link. Null means back to the task list. */
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
 * Walk forward from a step, skipping questions that are already answered, and stop
 * at the first unanswered question or at an outcome.
 *
 * One walk serves two situations. Going forward normally, nothing ahead is answered,
 * so it lands on the very next question. Coming back from the review page after a
 * change, it skips everything still answered and stops at whatever the change newly
 * opened up, or goes straight back to review if the change opened nothing.
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

/** The steps on the currently answered path, from the start. */
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
 * Where someone entering the section should land: the first question still unanswered
 * on the path their answers actually open, or null when there is nothing left to ask.
 *
 * It walks the branches rather than scanning the questions in the order they happen to
 * be declared, and that distinction is the whole point. A question the answers have
 * ruled out is never reached, so it is never answered — which makes it indistinguishable
 * from a question still waiting, to anything that only looks at whether an answer exists.
 *
 * Concretely: say no to "are you receiving support from another program?" and the
 * follow-up asking which program is off the path forever. Scan the list and it looks
 * unanswered, and the person gets asked which program supports them immediately after
 * saying none does.
 *
 * Null means finished, including finished by failing a gate. The caller decides where
 * that goes; re-entering a section that needs nothing means looking it over, and the
 * page showing every answer at once is where looking starts. That is this task's check
 * page, /eligibility/check.
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
 * Drop answers that the current path no longer reaches.
 *
 * Someone says they receive support from another program, names it, then goes back
 * and says no. The named program is now an answer to a question nobody asked. Left
 * in place it would show up on the review page, and it would come back if they
 * flipped the answer again, which reads as the service remembering something they
 * took back.
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

/** How many unanswered questions lie between a step and the end of the screener. */
export function remainingQuestions(from: StepId, a: EligibilityAnswers): number {
  let cur: StepId | Outcome = from;
  let n = 0;
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) n++;
    cur = NEXT[cur](a);
  }
  return n;
}

/** Whether the screener has been answered all the way to an outcome, and which one. */
export function screenerOutcome(a: EligibilityAnswers): Outcome | null {
  let cur: StepId | Outcome = FIRST_STEP;
  while (!isOutcome(cur)) {
    if (!isAnswered(cur, a)) return null;
    cur = NEXT[cur](a);
  }
  return cur;
}
