import type { DocumentAnswers, UploadedDocument } from "./form-state";
import { minSelected, required, runSchema, when, type Schema } from "./validation";

/**
 * Income and documents: proof of income, whether there is other income, and — only
 * if there is — what it is.
 *
 * A graph rather than an ordered list, because the last answer changes what is asked
 * next. That is the same rule the rest of this template follows for page breaks: an
 * answer that opens a further question forces a split rather than revealing a field
 * in place. The screener already treats the identical shape this way, asking "are you
 * receiving support from another program?" and "which program is supporting you?" on
 * two pages.
 *
 * The alternative considered and rejected was revealing the detail field under the
 * "yes". A field appearing the instant a radio is chosen reads as a lever — pick this,
 * get that — which nudges the answer, and on a page asking about income that nudge is
 * pointed in a direction nobody should be pointing it.
 *
 * Nothing here imports React.
 */

export type DocumentStepId = "proof-of-income" | "other-income" | "other-income-detail";

/** The end of the section: every question on the answered path has been answered. */
export type DocumentOutcome = "done";

export type DocumentField = keyof DocumentAnswers;

export type DocumentStepConfig = {
  /** The page heading, which on a single-question page is the question. */
  heading: string;
  /** The answers this page owns, in the order they appear on it. */
  fields: DocumentField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

export const DOCUMENT_STEPS: Record<DocumentStepId, DocumentStepConfig> = {
  "proof-of-income": {
    heading: "Upload proof of your income",
    fields: ["proofOfIncome"],
    schema: {
      /*
       * One rule, and only one, deliberately.
       *
       * Size and file type are enforced by the upload control, which refuses the file
       * before this page ever hears about it. A rule here for either would be a branch
       * that cannot execute — and a template is read as an example, so dead validation
       * teaches every fork to write more of it.
       */
      proofOfIncome: minSelected(1, "Upload at least one document showing your income"),
    },
  },

  "other-income": {
    heading: "Do you have any other income?",
    fields: ["hasOtherIncome"],
    schema: {
      hasOtherIncome: required("Select yes if you have any other income"),
    },
  },

  "other-income-detail": {
    heading: "What is your other income?",
    fields: ["otherIncomeDetail"],
    schema: {
      /*
       * Conditional on the answer that opened it, exactly as the child's living
       * arrangement is. Without the condition the rule would still run for someone
       * who said no, and the section could never be finished: they would be held back
       * by an error about a page they were never shown.
       */
      otherIncomeDetail: when(
        (answers) => answers.hasOtherIncome === "yes",
        required("Tell us where your other income comes from"),
      ),
    },
  },
};

export const DOCUMENT_STEP_IDS = Object.keys(DOCUMENT_STEPS) as DocumentStepId[];

export const FIRST_DOCUMENT_STEP: DocumentStepId = DOCUMENT_STEP_IDS[0];

export const isDocumentStep = (value: string | undefined): value is DocumentStepId =>
  DOCUMENT_STEP_IDS.includes(value as DocumentStepId);

export const isDocumentOutcome = (
  step: DocumentStepId | DocumentOutcome,
): step is DocumentOutcome => step === "done";

/* -------------------------------------------------------------------------- */
/* The branch                                                                  */
/* -------------------------------------------------------------------------- */

/** Where each page leads, given the answers so far. */
export const NEXT_DOCUMENT_STEP: Record<
  DocumentStepId,
  (answers: DocumentAnswers) => DocumentStepId | DocumentOutcome
> = {
  "proof-of-income": () => "other-income",
  "other-income": (a) => (a.hasOtherIncome === "yes" ? "other-income-detail" : "done"),
  "other-income-detail": () => "done",
};

/* -------------------------------------------------------------------------- */
/* Files                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The four things worth keeping from a browser File.
 *
 * The id is generated rather than taken from the file, because two files can share a
 * name and removal has to be unambiguous. The type is kept because the upload card
 * draws its icon from it — without it a restored page shows a generic file where the
 * live page showed a PDF, which reads as data lost on the way to storage.
 *
 * The file's contents are deliberately not here. This template stores answers in the
 * browser; a real service uploads the bytes to a server and keeps the reference. That
 * seam is `store/persistence.ts`.
 */
export function toUploadedDocument(
  id: string,
  file: { name: string; size: number; type: string },
): UploadedDocument {
  return { id, name: file.name, size: file.size, type: file.type };
}

/**
 * Add an uploaded file, replacing or accumulating according to what the page accepts.
 *
 * THE DESIGN SYSTEM HAS NO NOTION OF ONE FILE VERSUS MANY. `GoabFileUploadInput`
 * takes no `multiple` and no maximum; it raises one event per file and the service
 * owns the list. So every service has to decide this, nothing reminds it to, and the
 * decision shows up only when someone uploads a second file.
 *
 * The rule, and it is a rule rather than a preference: where a page takes one
 * document, a second upload REPLACES the first, because someone who can already see
 * their file on the page and uploads again is correcting it, not adding to it.
 * Accumulating there produces two documents where the service wanted one, and leaves
 * the person to work out which to delete. Where a page takes several, uploads
 * accumulate, because each one is a separate answer.
 */
export function addDocument(
  documents: UploadedDocument[],
  uploaded: UploadedDocument,
  acceptsMultiple: boolean,
): UploadedDocument[] {
  return acceptsMultiple ? [...documents, uploaded] : [uploaded];
}

/** Remove by id, never by index: the list re-renders and positions move. */
export const removeDocument = (documents: UploadedDocument[], id: string): UploadedDocument[] =>
  documents.filter((document) => document.id !== id);

/* -------------------------------------------------------------------------- */
/* Walking the section                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A page is finished when its own rules pass.
 *
 * A page that was never shown comes back finished, which is not a special case: its
 * rule is conditional on the answer that would have opened it, so a question nobody
 * was asked cannot be unanswered.
 */
export const isDocumentStepComplete = (id: DocumentStepId, answers: DocumentAnswers): boolean =>
  runSchema(DOCUMENT_STEPS[id].schema, answers as unknown as Record<string, unknown>).length === 0;

/**
 * The pages on the path these answers actually describe.
 *
 * The page is recorded before its answer is checked, so the page someone is standing
 * on is always part of the path even though they have not answered it yet.
 */
export function reachableDocumentSteps(answers: DocumentAnswers): Set<DocumentStepId> {
  const path = new Set<DocumentStepId>();
  let cur: DocumentStepId | DocumentOutcome = FIRST_DOCUMENT_STEP;
  while (!isDocumentOutcome(cur)) {
    path.add(cur);
    if (!isDocumentStepComplete(cur, answers)) break;
    cur = NEXT_DOCUMENT_STEP[cur](answers);
  }
  return path;
}

/**
 * Walk forward from a page, skipping questions already answered, and stop at the
 * first unanswered one or at the end of the section.
 *
 * One walk serves both a first run through and a change made later from the review
 * page: going forward, nothing ahead is answered, so it lands on the next question;
 * coming back from review, it skips what is still answered and stops at whatever the
 * change newly opened.
 */
export function resolveNextDocumentStep(
  from: DocumentStepId,
  answers: DocumentAnswers,
): { question: DocumentStepId } | { outcome: DocumentOutcome } {
  let cur = NEXT_DOCUMENT_STEP[from](answers);
  while (!isDocumentOutcome(cur)) {
    if (!isDocumentStepComplete(cur, answers)) return { question: cur };
    cur = NEXT_DOCUMENT_STEP[cur](answers);
  }
  return { outcome: cur };
}

/**
 * The page before this one, along the path taken rather than the declared order.
 *
 * Back has to retrace the person's own route. Someone who said they have no other
 * income was never shown the detail page, so there is nothing of it behind them.
 */
export function previousDocumentStep(
  step: DocumentStepId,
  answers: DocumentAnswers,
): DocumentStepId | null {
  const path = [...reachableDocumentSteps(answers)];
  const index = path.indexOf(step);
  return index > 0 ? path[index - 1] : null;
}

/**
 * The first page still needing work, or null when the section is finished.
 *
 * Null is where the caller decides: re-entering a section that needs nothing means
 * looking it over, and the page showing every answer at once is where looking starts.
 * That is this task's check page, /documents/check.
 */
export function firstIncompleteDocumentStep(answers: DocumentAnswers): DocumentStepId | null {
  let cur: DocumentStepId | DocumentOutcome = FIRST_DOCUMENT_STEP;
  while (!isDocumentOutcome(cur)) {
    if (!isDocumentStepComplete(cur, answers)) return cur;
    cur = NEXT_DOCUMENT_STEP[cur](answers);
  }
  return null;
}

/**
 * Drop answers the current path no longer reaches.
 *
 * Someone says they have other income, describes it, then goes back and says they do
 * not. The description is now an answer to a question nobody asked: it would show on
 * the review page, and it would reappear if they flipped back, which reads as the
 * service remembering something they took back.
 *
 * Only runs once the path is fully walked. A half-answered section says nothing about
 * what lies beyond the question it stopped at, and pruning on that basis would delete
 * work someone had already done.
 */
export function pruneDocuments(answers: DocumentAnswers): DocumentAnswers {
  if (firstIncompleteDocumentStep(answers) !== null) return answers;

  const live = reachableDocumentSteps(answers);
  const pruned = { ...answers };
  for (const id of DOCUMENT_STEP_IDS) {
    if (live.has(id)) continue;
    for (const field of DOCUMENT_STEPS[id].fields) {
      delete (pruned as Record<string, unknown>)[field];
    }
  }
  return pruned;
}
