import type { DocumentAnswers, UploadedDocument } from "../../lib/form-state";
import {
  minSelected,
  required,
  runSchema,
  when,
  type Schema,
} from "../../lib/validation";

/**
 * Income and documents: proof of income, whether there is other income, and only if
 * so what it is. A graph, because the last answer changes what is asked next, and the
 * follow-up is its own page rather than a reveal: see docs/design-notes.md.
 */

export type DocumentStepId = "proof-of-income" | "other-income" | "other-income-detail";

export type DocumentOutcome = "done";

export type DocumentField = keyof DocumentAnswers;

export type DocumentStepConfig = {
  heading: string;
  fields: DocumentField[];
  /** Rules for those answers, in field order so the error summary reads top to bottom. */
  schema: Schema;
};

export const DOCUMENT_STEPS: Record<DocumentStepId, DocumentStepConfig> = {
  "proof-of-income": {
    heading: "Upload proof of your income",
    fields: ["proofOfIncome"],
    schema: {
      // One rule only: size and file type are enforced by the upload control before
      // this page ever hears about the file.
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
      // Conditional on the answer that opened it; without `when`, someone who said no
      // could never finish the section.
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

export const NEXT_DOCUMENT_STEP: Record<
  DocumentStepId,
  (answers: DocumentAnswers) => DocumentStepId | DocumentOutcome
> = {
  "proof-of-income": () => "other-income",
  "other-income": (a) => (a.hasOtherIncome === "yes" ? "other-income-detail" : "done"),
  "other-income-detail": () => "done",
};

/**
 * What is kept from a browser File: a generated id (two files can share a name) and
 * the type (the upload card draws its icon from it). Never the contents: a real
 * service uploads the bytes and keeps the reference, at `store/persistence.ts`.
 */
export function toUploadedDocument(
  id: string,
  file: { name: string; size: number; type: string },
): UploadedDocument {
  return { id, name: file.name, size: file.size, type: file.type };
}

/**
 * `GoabFileUploadInput` raises one event per file and has no notion of one versus
 * many, so the service decides: where a page takes one document a second upload
 * replaces the first (the person is correcting, not adding); where it takes several,
 * uploads accumulate.
 */
export function addDocument(
  documents: UploadedDocument[],
  uploaded: UploadedDocument,
  acceptsMultiple: boolean,
): UploadedDocument[] {
  return acceptsMultiple ? [...documents, uploaded] : [uploaded];
}

/** Remove by id, never by index: the list re-renders and positions move. */
export const removeDocument = (
  documents: UploadedDocument[],
  id: string,
): UploadedDocument[] => documents.filter((document) => document.id !== id);

/**
 * A page is finished when its own rules pass. A page never shown comes back finished,
 * since its rule is conditional on the answer that would have opened it.
 */
export const isDocumentStepComplete = (
  id: DocumentStepId,
  answers: DocumentAnswers,
): boolean =>
  runSchema(DOCUMENT_STEPS[id].schema, answers as unknown as Record<string, unknown>)
    .length === 0;

/**
 * The pages on the path these answers describe. A page is recorded before its answer
 * is checked, so the page someone is standing on is always on the path.
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
 * Walk forward, skipping answered questions, to the first unanswered one or the end
 * of the section. Serves a first run and a change from review alike: the change stops
 * at whatever it newly opened.
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

/** The page before this one along the path taken, so Back retraces the route walked. */
export function previousDocumentStep(
  step: DocumentStepId,
  answers: DocumentAnswers,
): DocumentStepId | null {
  const path = [...reachableDocumentSteps(answers)];
  const index = path.indexOf(step);
  return index > 0 ? path[index - 1] : null;
}

/**
 * The first page still needing work, or null when the section is finished; the caller
 * sends null to this task's check page, /documents/check.
 */
export function firstIncompleteDocumentStep(
  answers: DocumentAnswers,
): DocumentStepId | null {
  let cur: DocumentStepId | DocumentOutcome = FIRST_DOCUMENT_STEP;
  while (!isDocumentOutcome(cur)) {
    if (!isDocumentStepComplete(cur, answers)) return cur;
    cur = NEXT_DOCUMENT_STEP[cur](answers);
  }
  return null;
}

/**
 * Drop answers the current path no longer reaches, so a taken-back answer neither
 * shows on review nor reappears. Only once the path is fully walked: pruning a
 * half-answered section would delete work already done.
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
