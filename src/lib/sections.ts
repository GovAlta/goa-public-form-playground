import type { FormState, SectionId } from "./form-state";
import { screenerOutcome } from "../sections/eligibility/rules";
import { childrenComplete } from "../sections/your-children/rules";

/**
 * What this service asks for, as a list, and what counts as having finished each part.
 * The task list and the review page both read it, so they cannot disagree. A task is
 * a section, not a question: "About you" is one row however many pages it has.
 */

// Re-exported from form-state, which has to name the sections a draft holds.
export type { SectionId };

export type SectionStatus = "cannot-start" | "not-started" | "in-progress" | "completed";

export type Section = {
  id: SectionId;
  title: string;
  group: string;
  route: string;
  isUnlocked: (state: FormState) => boolean;
  /**
   * Every required answer present. A fact about the answers alone; not the same as
   * Completed, see isComplete.
   */
  isAnswered: (state: FormState) => boolean;
  isStarted: (state: FormState) => boolean;
  /**
   * Whether this task ends on its own check-answers page. Default true; turn it off
   * for a task that asks one question, where a check page would show the single answer
   * the person is already looking at. Keep it in step with the section's routes: true
   * with no check route means the task can never complete.
   */
  hasCheckPage: boolean;
};

const hasText = (v: string | undefined): boolean =>
  typeof v === "string" && v.trim() !== "";

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
    // Not a count: adding a child creates the record immediately. See src/sections/your-children/rules.ts.
    isAnswered: (s) => childrenComplete(s.children),
    isStarted: (s) => s.children.length > 0,
    // The list is this task's check page; its Continue records the confirmation.
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

export const isConfirmed = (id: SectionId, state: FormState): boolean =>
  state.confirmed.includes(id);

/**
 * Completed, as the task list means it: every required answer present AND the person
 * has passed through the task's check-answers page (see FormState.confirmed).
 */
export const isComplete = (section: Section, state: FormState): boolean =>
  section.isAnswered(state) && (!section.hasCheckPage || isConfirmed(section.id, state));

/**
 * The status shown on the task list. Locked beats everything: calling a section the
 * person cannot open "not started" would invite them to try.
 */
export function sectionStatus(section: Section, state: FormState): SectionStatus {
  if (!section.isUnlocked(state)) return "cannot-start";
  if (isComplete(section, state)) return "completed";
  if (section.isStarted(state)) return "in-progress";
  return "not-started";
}

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
 * What is still unfinished, in task list order, so the review page can name each
 * part with a link to it. Locked sections are included: they are still a reason the
 * application cannot be sent.
 */
export const incompleteSections = (state: FormState): Section[] =>
  SECTIONS.filter((s) => !isComplete(s, state));

/**
 * Every task answered and checked. The same definition the task list uses, so the
 * two pages cannot disagree in front of the person.
 */
export const canSubmit = (state: FormState): boolean =>
  SECTIONS.every((s) => isComplete(s, state));
