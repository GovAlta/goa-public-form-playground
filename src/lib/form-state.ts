/**
 * The shape of a part-finished application, and the only ways it can change.
 *
 * This file has no React in it. What a person has told this service, and the rules
 * about what counts as finished, are facts about the service rather than facts about
 * how it is rendered.
 *
 * The state is typed per section rather than a single bag of strings. A bag would be
 * shorter, but this is a template: the shape is the clearest documentation of what
 * the service actually asks, and it is the thing you will edit first.
 */

export type YesNo = "yes" | "no";

/**
 * The four parts of this application, named.
 *
 * Here rather than in lib/sections.ts, where the rest of the task list's model lives,
 * because the state below has to name them: which tasks the person has confirmed is
 * part of what a draft holds. sections.ts re-exports it, so nothing outside had to
 * learn a new import.
 */
export type SectionId = "eligibility" | "about-you" | "your-children" | "documents";

/** Screener answers. See lib/eligibility.ts for how they branch. */
export type EligibilityAnswers = {
  age?: YesNo;
  residency?: YesNo;
  otherSupport?: YesNo;
  otherSupportDetail?: string;
};

export type AboutYouAnswers = {
  firstName?: string;
  lastName?: string;
  /** ISO date, yyyy-mm-dd. Stored as text: a date of birth has no time and no timezone. */
  dateOfBirth?: string;
  phone?: string;
  /** The only optional answer in this section. */
  email?: string;
  street?: string;
  /** Optional. Not everyone has one, and most people in apartments do. */
  suite?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type ChildRecord = {
  /** Stable id, generated on add. Used as the React key and for edit and remove. */
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  livesWithYou?: YesNo;
  /** Only asked when the child does not live with the applicant. */
  livingArrangement?: string;
};

export type UploadedDocument = {
  /** Generated on upload. Two files can share a name, so removal needs its own key. */
  id: string;
  name: string;
  size: number;
  /** The MIME type. Kept because the upload card draws its icon from it. */
  type: string;
};

export type DocumentAnswers = {
  proofOfIncome: UploadedDocument[];
  hasOtherIncome?: YesNo;
  otherIncomeDetail?: string;
};

export type FormState = {
  eligibility: EligibilityAnswers;
  aboutYou: AboutYouAnswers;
  children: ChildRecord[];
  documents: DocumentAnswers;
  /**
   * ISO timestamp, set on submit.
   *
   * Non-null means the application is no longer editable, and that is enforced rather
   * than merely stated: the route table wraps every question page in a guard that
   * sends a submitted application to its confirmation instead (see index.tsx).
   * A comment claiming a rule nothing implements is worse than no rule in a template,
   * because a fork reads it as a guarantee.
   */
  submittedAt: string | null;
  /**
   * The tasks whose check-answers page the person has passed through.
   *
   * A task is Completed on the task list when its answers are all present AND it is
   * listed here. Answering the last question is not enough: each task ends on a page
   * showing everything it collected, and pressing Continue there is the person saying
   * they have looked. That is why every task has such a page.
   *
   * NECESSARY, NOT SUFFICIENT — which is what saves this from being a second source
   * of truth that drifts from the answers. Nothing ever removes an id from this list.
   * It does not have to: a change that reopens a question (saying yes to other income
   * opens a question about it) makes the answers incomplete on their own, and the row
   * drops back to In progress with no un-confirming logic anywhere. And correcting a
   * typo from the final review does not punish the person by reverting a task they
   * already checked.
   */
  confirmed: SectionId[];
  /**
   * The receipt for a submitted application, set at the same moment as submittedAt.
   *
   * It is part of the saved state rather than something the confirmation page holds
   * in memory, because a person refreshing the page they were told to keep is the
   * likeliest thing to happen next, and losing their reference then is unforgivable.
   */
  reference: string | null;
};

export const EMPTY_FORM: FormState = {
  eligibility: {},
  aboutYou: {},
  children: [],
  documents: { proofOfIncome: [] },
  submittedAt: null,
  confirmed: [],
  reference: null,
};

export type FormAction =
  | { type: "save-eligibility"; answers: EligibilityAnswers }
  | { type: "save-about-you"; answers: AboutYouAnswers }
  | { type: "add-child"; child: ChildRecord }
  | { type: "update-child"; id: string; child: ChildRecord }
  | { type: "remove-child"; id: string }
  | { type: "save-documents"; answers: DocumentAnswers }
  | { type: "confirm-section"; id: SectionId }
  | { type: "submit"; at: string; reference: string }
  | { type: "hydrate"; state: FormState }
  | { type: "reset" };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "save-eligibility":
      // Replaces rather than merges. The screener owns its whole answer set, and
      // pruning answers that a changed earlier answer made unreachable is its job
      // (see lib/eligibility.ts). A merge here would quietly resurrect them.
      return { ...state, eligibility: action.answers };

    case "save-about-you":
      return { ...state, aboutYou: { ...state.aboutYou, ...action.answers } };

    case "add-child":
      return { ...state, children: [...state.children, action.child] };

    case "update-child":
      return {
        ...state,
        children: state.children.map((c) => (c.id === action.id ? action.child : c)),
      };

    case "remove-child":
      return { ...state, children: state.children.filter((c) => c.id !== action.id) };

    case "save-documents":
      // Replaces rather than merges, for the same reason the screener does. This
      // section branches, so pruning answers a changed earlier answer made
      // unreachable is its job — and a merge here would quietly resurrect them.
      return { ...state, documents: action.answers };

    case "confirm-section":
      // Idempotent, because the page that dispatches it can be visited any number of
      // times. A person who checks their answers twice has not confirmed twice.
      return state.confirmed.includes(action.id)
        ? state
        : { ...state, confirmed: [...state.confirmed, action.id] };

    case "submit":
      // Both fields together, always. A submitted application with no reference is a
      // confirmation page with nothing on it to write down.
      return { ...state, submittedAt: action.at, reference: action.reference };

    case "hydrate":
      return action.state;

    case "reset":
      return EMPTY_FORM;
  }
}
