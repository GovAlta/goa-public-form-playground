import type { ChildRecord } from "./form-state";
import { all, dateInThePast, required, runSchema, when, type Schema } from "./validation";

/**
 * Your children: a repeating group, where each child is added by walking a short
 * sub-flow of pages rather than by filling in an overlay.
 *
 * Why pages, and not a modal or a drawer. A child here is four questions, and one of
 * the answers changes what is asked next: a child who does not live with you is asked
 * who they do live with, and a child who does is not. The rule this template follows
 * for the form as a whole is that an answer which changes the next question forces a
 * page break, and there is no reason that rule should stop applying because the
 * questions happen to be inside a loop. So the sub-flow is built from the same pieces
 * as the rest of the form, and a person walking it barely notices they left the list.
 *
 * The rule of thumb behind the choice, for anyone forking this and collecting
 * something else: one field per item belongs inline on the page itself, a handful of
 * fields with no branching belongs in a modal, more fields than that in a drawer, and
 * an item with enough to it — or with a branch in it — gets its own pages.
 *
 * Structurally this is the screener next door, scoped to one item: a graph of steps,
 * walkers over it, and a prune for answers the current path no longer reaches. That
 * repetition is the point. A repeating group is the form pattern looped, not a
 * different kind of thing, and the sub-flow ends on its own small check page for the
 * same reason the form as a whole ends on a review.
 *
 * Nothing here imports React.
 */

export type ChildStepId = "name" | "date-of-birth" | "lives-with-you" | "living-arrangement";

/**
 * The end of one child's sub-flow: every question on their path is answered.
 *
 * Named for the state rather than for a page, because the two flows through here end
 * somewhere different. Adding a child returns to the list, where the new row is its
 * own confirmation. Changing one returns to that child's check page, which is where
 * the change was started from.
 */
export type ChildOutcome = "done";

/** Every answer a child page collects. Derived, so a new field cannot be forgotten. */
export type ChildField = Exclude<keyof ChildRecord, "id">;

export type ChildStepConfig = {
  /**
   * The page heading, built from the child rather than fixed.
   *
   * A parent adding a third child should not see the same four anonymous headings
   * they saw for the first two. Once a name has been given, every later question in
   * that child's sub-flow says whose answer it is collecting.
   */
  heading: (child: ChildRecord) => string;
  /** The answers this page owns, in the order they appear on it. */
  fields: ChildField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

/** What to call a child mid-sentence, before their name is known. */
function shortName(child: ChildRecord): string {
  return child.firstName.trim() || "the child";
}

/* -------------------------------------------------------------------------- */
/* The four questions                                                          */
/* -------------------------------------------------------------------------- */

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
      /*
       * Conditional on the answer that opened it.
       *
       * Without the condition this rule would still be run for a child who lives
       * with the applicant, and the section could never be finished: the page is
       * not on their path, so the question is never shown, and they would be held
       * back by an error about a field that is not on screen anywhere.
       */
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

/* -------------------------------------------------------------------------- */
/* The branch                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Where each question leads, given the answers so far.
 *
 * A graph rather than conditionals inside the pages, for the same reason the screener
 * is one: more than one thing needs to walk it. Going forward through the questions,
 * working out where someone lands after changing an answer on the check page, and
 * deciding which answers are still live all read this same map.
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

/* -------------------------------------------------------------------------- */
/* Walking one child's sub-flow                                                */
/* -------------------------------------------------------------------------- */

/**
 * A page is finished when its own rules pass.
 *
 * Off-path pages come back finished, which is not a special case bolted on: their
 * rules are conditional on the answer that would have opened them, so a question
 * nobody was asked cannot be unanswered.
 */
export const isChildStepComplete = (id: ChildStepId, child: ChildRecord): boolean =>
  runSchema(CHILD_STEPS[id].schema, child as unknown as Record<string, unknown>).length === 0;

/**
 * The questions on the path this child's answers actually describe.
 *
 * The step is recorded before its answer is checked, so the page someone is standing
 * on is always part of the path, even though they have not answered it yet.
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
 * Walk forward from a page, skipping questions already answered, and stop at the
 * first unanswered one or at the check page.
 *
 * One walk serves two situations, exactly as it does in the screener. Going forward
 * normally, nothing ahead is answered, so it lands on the very next question. Coming
 * back from the check page after a change, it skips everything still answered and
 * stops at whatever the change newly opened up — so saying a child no longer lives
 * with you asks the one new question, and correcting a spelling goes straight back.
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
 * The page before this one, along the path taken rather than the declared order.
 *
 * Back has to retrace the person's own route. For a child who lives with you the
 * living arrangement was never shown, so the page before the check is the one that
 * asked. Null means there is nothing behind this page but the list of children.
 */
export function previousChildStep(step: ChildStepId, child: ChildRecord): ChildStepId | null {
  const path = [...reachableChildSteps(child)];
  const index = path.indexOf(step);
  return index > 0 ? path[index - 1] : null;
}

/** The first question this child still needs answered, or null when none remain. */
export function firstIncompleteChildStep(child: ChildRecord): ChildStepId | null {
  let cur: ChildStepId | ChildOutcome = FIRST_CHILD_STEP;
  while (!isChildOutcome(cur)) {
    if (!isChildStepComplete(cur, child)) return cur;
    cur = NEXT_CHILD_STEP[cur](child);
  }
  return null;
}

/** Every question on this child's path has been answered. */
export const isChildComplete = (child: ChildRecord): boolean =>
  firstIncompleteChildStep(child) === null;

/**
 * Drop answers the current path no longer reaches.
 *
 * Someone says a child lives elsewhere, says who with, then goes back and says the
 * child does live with them. The living arrangement is now an answer to a question
 * nobody asked: it would show on the review page, and it would reappear if they
 * flipped back, which reads as the service remembering something they took back.
 *
 * Only runs on a child whose path is fully walked. A half-answered child tells us
 * nothing about what lies beyond the question they stopped at, and pruning on that
 * basis would delete work someone had already done.
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

/* -------------------------------------------------------------------------- */
/* The group                                                                   */
/* -------------------------------------------------------------------------- */

/** A child at the moment they are added: an id, and nothing answered yet. */
export function emptyChild(id: string): ChildRecord {
  return { id, firstName: "", lastName: "", dateOfBirth: "" };
}

/**
 * What a child is called in the list and on the review page.
 *
 * Which field acts as the heading for a repeated item is a decision somebody has to
 * make; there is no way to derive it, and picking wrong gives a list of rows nobody
 * can tell apart. Here it is the name, and it is named in one place so the list, the
 * check page and the review page cannot disagree.
 *
 * The fallback is load-bearing rather than defensive. Because answers are saved as
 * they are given, a child added and abandoned before the name page was finished is a
 * real state, and that row still has to be identifiable enough to finish or remove.
 */
export function childLabel(child: ChildRecord): string {
  const name = [child.firstName, child.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Child with no name yet";
}

/**
 * The section is finished when at least one child has been added and every one of
 * them is finished.
 *
 * The count alone is not enough. Adding a child creates the record immediately, so a
 * list with a row in it can still be a list of unfinished work, and a task list that
 * called that "completed" would send someone to submit an application with a nameless
 * child in it.
 */
export const childrenComplete = (children: ChildRecord[]): boolean =>
  children.length > 0 && children.every(isChildComplete);

/*
 * There is deliberately no field-to-page lookup here, and About you has one.
 *
 * The difference is what each review shows. About you's review lists every answer, so
 * a Change beside a postal code has to find the page that asks for it. A repeating
 * group collapses on review to each item's name, with one Change back to the list —
 * a review page listing eight fields per child for four children is unreadable, and
 * the person only needs to confirm the right people are listed.
 *
 * So nothing ever asks which page a child's field lives on. The check page groups its
 * rows by page already, and links per group. A lookup written here would be correct,
 * tested, and never called, which in a template is worse than missing: it is read as
 * an example, and every fork would carry one too.
 */
