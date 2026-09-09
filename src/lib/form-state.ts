/**
 * The shape of a part-finished application, and the only ways it can change. Typed
 * per section rather than a bag of strings: the shape is the clearest description of
 * what the service asks, and the first thing a fork edits.
 */

export type YesNo = "yes" | "no";

export type SectionId = "eligibility" | "about-you" | "your-children" | "documents";

/** Screener answers. See src/sections/eligibility/rules.ts for how they branch. */
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
  email?: string;
  street?: string;
  suite?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type ChildRecord = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  livesWithYou?: YesNo;
  livingArrangement?: string;
};

export type UploadedDocument = {
  /** Generated on upload. Two files can share a name, so removal needs its own key. */
  id: string;
  name: string;
  size: number;
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
   * ISO timestamp, set on submit. Non-null means no longer editable, enforced by the
   * guard in src/routes/guards.tsx that sends a submitted application to its confirmation.
   */
  submittedAt: string | null;
  /**
   * Tasks whose check-answers page the person has passed through. Necessary, never
   * sufficient: nothing removes an id, because a change that reopens a question makes
   * the answers incomplete on their own and the task drops back to In progress.
   */
  confirmed: SectionId[];
  /**
   * The receipt, set with submittedAt and saved with the draft: refreshing the
   * confirmation page is the likeliest next thing, and losing the reference then is
   * unforgivable.
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
      // Replaces rather than merges: pruning unreachable answers is the screener's job
      // (src/sections/eligibility/rules.ts), and a merge would quietly resurrect them.
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
      // Replaces rather than merges, for the same reason as the screener.
      return { ...state, documents: action.answers };

    case "confirm-section":
      return state.confirmed.includes(action.id)
        ? state
        : { ...state, confirmed: [...state.confirmed, action.id] };

    case "submit":
      return { ...state, submittedAt: action.at, reference: action.reference };

    case "hydrate":
      return action.state;

    case "reset":
      return EMPTY_FORM;
  }
}
