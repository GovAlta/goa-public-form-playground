import type { FormState, SectionId } from "./form-state";
import { screenerOutcome } from "./eligibility";
import { childrenComplete } from "./your-children";

/**
 * What this service asks for, as a list, and what counts as having finished each part.
 *
 * This is the piece the task list and the review page both need. Neither can do its
 * job without knowing which parts are done: the task list shows a status against
 * every row, and the review page has to know whether the application can be
 * submitted at all.
 *
 * Rather than letting those two pages each work it out and drift apart, the rule
 * lives here once and both read it. It is the answer to a coupling that would
 * otherwise be silent.
 *
 * A task is a section of the service, not a single question. "About you" is four
 * questions across two pages; it is still one row on the task list, because that is
 * how a person thinks about what they have left to do.
 */

// Defined beside the state it describes, re-exported here because this is where
// anything reasoning about the task list looks for it.
export type { SectionId };

export type SectionStatus = "cannot-start" | "not-started" | "in-progress" | "completed";

export type Section = {
  id: SectionId;
  /** The task list row label. */
  title: string;
  /** The heading this section sits under on the task list. */
  group: string;
  /** Where the row links to. */
  route: string;
  /** Whether the person is allowed to start this yet. */
  isUnlocked: (state: FormState) => boolean;
  /**
   * Whether every required answer in this section is present.
   *
   * Not the same as Completed on the task list, and the difference is the point: see
   * isComplete below. This is a fact about the answers alone.
   */
  isAnswered: (state: FormState) => boolean;
  /** Whether the person has started but not finished. */
  isStarted: (state: FormState) => boolean;
  /**
   * Whether this task ends on its own check-answers page.
   *
   * True for every task in this service, and the default a new one should take. It is
   * a per-task switch rather than a rule worked out from how many questions the task
   * has, because the judgement is not really about the count: a task asking one thing
   * would be showing a person a single answer they are still looking at, which is
   * ceremony, and only whoever designed the task knows whether that is the case.
   *
   * Turning it off has two effects and they go together: the last question returns
   * straight to the task list, and the task is Completed on its answers alone. Leave
   * the switch and the section's own routing in step — a task with no check route but
   * this still true can never be completed, which shows up as a row that stays
   * "In progress" no matter what the person does.
   */
  hasCheckPage: boolean;
};

const hasText = (v: string | undefined): boolean => typeof v === "string" && v.trim() !== "";

/** The screener has to pass before the rest of the application opens up. */
const screenerPassed = (state: FormState): boolean =>
  screenerOutcome(state.eligibility) === "review";

export const SECTIONS: Section[] = [
  {
    id: "eligibility",
    title: "Check if you can apply",
    group: "Before you apply",
    route: "/eligibility",
    isUnlocked: () => true,
    isAnswered: (s) => screenerOutcome(s.eligibility) !== null,
    isStarted: (s) => Object.keys(s.eligibility).length > 0,
    hasCheckPage: true,
  },
  {
    id: "about-you",
    title: "About you",
    group: "Your application",
    route: "/about-you",
    isUnlocked: screenerPassed,
    isAnswered: (s) => {
      const a = s.aboutYou;
      return (
        hasText(a.firstName) &&
        hasText(a.lastName) &&
        hasText(a.dateOfBirth) &&
        hasText(a.phone) &&
        hasText(a.street) &&
        hasText(a.city) &&
        hasText(a.province) &&
        hasText(a.postalCode)
      );
    },
    isStarted: (s) => Object.values(s.aboutYou).some((v) => hasText(v as string)),
    hasCheckPage: true,
  },
  {
    id: "your-children",
    title: "Your children",
    group: "Your application",
    route: "/your-children",
    isUnlocked: screenerPassed,
    // Not a count. Adding a child creates the record immediately, so a list with a
    // row in it can still be a list of unfinished work; every child has to have
    // answered every question on its own path. See lib/your-children.ts.
    isAnswered: (s) => childrenComplete(s.children),
    isStarted: (s) => s.children.length > 0,
    // The list IS this task's check page: it shows every child with a way to change
    // each one, and its Continue is where the confirmation is recorded.
    hasCheckPage: true,
  },
  {
    id: "documents",
    title: "Income and documents",
    group: "Your application",
    route: "/documents",
    isUnlocked: screenerPassed,
    isAnswered: (s) => {
      const d = s.documents;
      if (d.proofOfIncome.length === 0) return false;
      if (d.hasOtherIncome === undefined) return false;
      if (d.hasOtherIncome === "yes") return hasText(d.otherIncomeDetail);
      return true;
    },
    isStarted: (s) =>
      s.documents.proofOfIncome.length > 0 || s.documents.hasOtherIncome !== undefined,
    hasCheckPage: true,
  },
];

export function sectionById(id: SectionId): Section {
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown section: ${id}`);
  return section;
}

/** Whether the person has passed through this task's check-answers page. */
export const isConfirmed = (id: SectionId, state: FormState): boolean =>
  state.confirmed.includes(id);

/**
 * Completed, as the task list means it.
 *
 * TWO CONDITIONS, AND THE SECOND IS THE ONE PEOPLE GET WRONG. Every required answer
 * has to be present, and the person has to have passed through the task's own
 * check-answers page. A task's review is not decoration on the end of the questions:
 * it is the step that completes the task, which is why answering the last question
 * takes you to it rather than back to the task list.
 *
 * Being confirmed is necessary and never sufficient — see FormState.confirmed for why
 * that is what keeps the flag from drifting away from the answers.
 *
 * A task that has opted out of a check page is Completed on its answers alone, since
 * there is no page it could ever be confirmed on.
 */
export const isComplete = (section: Section, state: FormState): boolean =>
  section.isAnswered(state) && (!section.hasCheckPage || isConfirmed(section.id, state));

/**
 * The status shown on the task list.
 *
 * Order matters. Locked beats everything, because a person cannot act on a section
 * they are not allowed to open, and telling them it is "not started" would invite
 * them to try.
 */
export function sectionStatus(section: Section, state: FormState): SectionStatus {
  if (!section.isUnlocked(state)) return "cannot-start";
  if (isComplete(section, state)) return "completed";
  if (section.isStarted(state)) return "in-progress";
  return "not-started";
}

/** Sections in task list order, grouped under their headings. */
export function sectionGroups(): { title: string; sections: Section[] }[] {
  const groups: { title: string; sections: Section[] }[] = [];
  for (const section of SECTIONS) {
    const existing = groups.find((g) => g.title === section.group);
    if (existing) existing.sections.push(section);
    else groups.push({ title: section.group, sections: [section] });
  }
  return groups;
}

export const completedCount = (state: FormState): number =>
  SECTIONS.filter((s) => isComplete(s, state)).length;

/**
 * What is still unanswered, in task list order.
 *
 * The review page needs this and not just a yes/no, because someone who arrives
 * before they are finished has to be told which parts are outstanding, by name, with
 * a way to each one. "You cannot submit yet" on its own is a locked door with no sign
 * on it.
 *
 * Locked sections are included. A section the screener has not opened yet is still a
 * reason this application cannot be sent, and leaving it out would produce a list
 * that does not add up to the whole application.
 */
export const incompleteSections = (state: FormState): Section[] =>
  SECTIONS.filter((s) => !isComplete(s, state));

/**
 * Every task is answered and checked, so the application can be submitted.
 *
 * The same definition the task list uses, deliberately. A review page offering to
 * send an application the task list still calls unfinished is the two pages
 * disagreeing in front of the person, and they have no way to tell which is right.
 */
export const canSubmit = (state: FormState): boolean =>
  SECTIONS.every((s) => isComplete(s, state));
