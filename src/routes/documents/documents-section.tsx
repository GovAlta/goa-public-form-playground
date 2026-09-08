import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import {
  GoabDetails,
  GoabFileUploadCard,
  GoabFileUploadInput,
  GoabFormItem,
  GoabRadioGroup,
  GoabRadioItem,
  GoabTextArea,
} from "@abgov/react-components";
import { PublicFormLayout } from "../../components/public-form-layout";
import { TaskReview } from "../../components/task-review";
import { DocumentsSummary } from "../review/summaries";
import { FormSet } from "../../components/form-set";
import { useFormValidation } from "../../components/use-form-validation";
import {
  addDocument,
  DOCUMENT_STEPS,
  DOCUMENT_STEP_IDS,
  firstIncompleteDocumentStep,
  previousDocumentStep,
  pruneDocuments,
  removeDocument,
  resolveNextDocumentStep,
  toUploadedDocument,
  type DocumentStepId,
} from "../../lib/documents";
import type { DocumentAnswers, YesNo } from "../../lib/form-state";
import { RETURN_LABELS, readReturnTo, withReturnTo, type ReturnTo } from "../../lib/return-to";
import { newId, useForm } from "../../store/form-store";

/**
 * Income and documents: proof of income, whether there is other income, and what it
 * is when there is.
 *
 * Three pages rather than two with a reveal, because the second answer changes what
 * is asked next and this template splits on that rather than revealing in place. The
 * reasoning, and the argument against the reveal, is in lib/documents.ts.
 */

const SECTION_ROOT = "/documents";

/** This task's own check-answers page: where the section finishes. */
export const DOCUMENTS_CHECK_PATH = `${SECTION_ROOT}/check`;

/** The two pages a question here can be reached from. See lib/return-to.ts. */
const RETURN_PATHS = {
  review: "/review",
  task: DOCUMENTS_CHECK_PATH,
} as const;

const SUPPORTED = ["review", "task"] as const;

const stepPath = (step: DocumentStepId, returnTo: ReturnTo | null) =>
  withReturnTo(`${SECTION_ROOT}/${step}`, returnTo);

/**
 * Whether the proof-of-income page takes more than one document.
 *
 * True here because income comes from more than one place. Set it to false and
 * uploading a second file replaces the first rather than adding to it — see
 * addDocument in lib/documents.ts for why that is the right behaviour for a
 * single-document page, and note that the design system's upload control has no
 * opinion on this at all.
 */
const ACCEPTS_MULTIPLE_FILES = true;

/* -------------------------------------------------------------------------- */

/**
 * What every page here shares: where Back goes, and where Continue goes given the
 * answers as they stand after this page's own save.
 */
function useDocumentStep(step: DocumentStepId) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const config = DOCUMENT_STEPS[step];

  // Carried in the URL rather than router state, so a refresh mid-change still
  // returns to the page being checked instead of silently rejoining a normal run.
  const returnTo = readReturnTo(params, SUPPORTED);

  const { errors, submit, revalidate } = useFormValidation(config.schema);

  /**
   * Save this page's answer and go wherever the answers now lead.
   *
   * Pruned before saving, so an answer the changed path no longer reaches does not
   * sit in the store waiting to reappear if the person flips back.
   */
  const saveAndContinue = (answers: DocumentAnswers) => {
    const saved = pruneDocuments(answers);
    dispatch({ type: "save-documents", answers: saved });

    const next = resolveNextDocumentStep(step, saved);
    if ("question" in next) {
      navigate(stepPath(next.question, returnTo));
      return;
    }
    // Back to whichever page sent them here, and when nothing did, on to this task's
    // own check page: the end of the questions is the end of the task.
    navigate(returnTo ? RETURN_PATHS[returnTo] : DOCUMENTS_CHECK_PATH);
  };

  const previous = previousDocumentStep(step, state.documents);

  return {
    heading: config.heading,
    documents: state.documents,
    dispatch,
    errors,
    errorFor: (field: string) => errors.find((e) => e.fieldId === field)?.text,
    submit,
    revalidate,
    saveAndContinue,
    back: returnTo ? RETURN_PATHS[returnTo] : previous ? stepPath(previous, null) : "/",
    backLabel: returnTo ? RETURN_LABELS[returnTo] : "Back",
    continueLabel: returnTo ? "Save and return" : "Save and continue",
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Proof of income.
 *
 * The one page in this service where answers are committed the moment they are given
 * rather than on Continue, and the difference is not arbitrary. Typing is an edit in
 * progress: a half-typed postal code someone abandons should not be saved. Uploading
 * is a completed action with its own visible result — the card appears — and in a
 * real service the bytes have already left the browser by then. Discarding it on Back
 * would throw away something the person watched succeed.
 *
 * One component gap worth knowing about: GoabFileUploadInput takes no error prop, so
 * a missing file is reported by the summary and the form item but cannot turn the
 * dropzone itself red.
 */
function ProofOfIncomePage() {
  const {
    heading,
    documents,
    dispatch,
    errors,
    errorFor,
    submit,
    revalidate,
    saveAndContinue,
    back,
    backLabel,
    continueLabel,
  } = useDocumentStep("proof-of-income");

  const files = documents.proofOfIncome;

  const saveFiles = (next: typeof files) => {
    dispatch({ type: "save-documents", answers: { ...documents, proofOfIncome: next } });
    revalidate({ ...documents, proofOfIncome: next } as unknown as Record<string, unknown>);
  };

  const handleSelect = (detail: { file: File }) =>
    saveFiles(
      addDocument(files, toUploadedDocument(newId(), detail.file), ACCEPTS_MULTIPLE_FILES),
    );

  const handleDelete = (id: string) => saveFiles(removeDocument(files, id));

  const handleContinue = () =>
    submit(documents as unknown as Record<string, unknown>, () => saveAndContinue(documents));

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        description="Send us something that shows what you earn. You can add more than one document."
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem
          id="proofOfIncome"
          // The dropzone states the size limit itself, so saying it again here just
          // makes the person read the same constraint twice. Help text earns its
          // place by adding what the control does not say — here, the file types.
          helpText="You can upload JPG, PNG or PDF files."
          error={errorFor("proofOfIncome")}
        >
          <GoabFileUploadInput
            variant="dragdrop"
            accept=".jpg,.jpeg,.png,.pdf"
            maxFileSize="10MB"
            onSelectFile={handleSelect}
          />

          {/*
            Uploaded files sit below the drop area, not above it.

            The drop area is the control and the cards are its result, so the result
            belongs after the thing that produced it. Putting the cards first pushes
            the drop area further down the page with every file added — the control
            someone is about to use again moves, and on a page with several documents
            it eventually moves off the screen.
          */}
          {files.length > 0 && (
            <div style={{ marginTop: "var(--goa-space-m)" }}>
              {files.map((file) => (
                <GoabFileUploadCard
                  key={file.id}
                  filename={file.name}
                  size={file.size}
                  type={file.type}
                  onDelete={() => handleDelete(file.id)}
                />
              ))}
            </div>
          )}
        </GoabFormItem>

        <GoabDetails heading="What counts as proof of income?" mt="l">
          <p>Any recent document showing money you receive, such as:</p>
          <ul>
            <li>a pay stub from the last three months</li>
            <li>a letter from your employer</li>
            <li>a benefit or pension statement</li>
            <li>your most recent notice of assessment</li>
          </ul>
          <p>Make sure your name and the amount are both readable.</p>
        </GoabDetails>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */

function OtherIncomePage() {
  const {
    heading,
    documents,
    errors,
    errorFor,
    submit,
    revalidate,
    saveAndContinue,
    back,
    backLabel,
    continueLabel,
  } = useDocumentStep("other-income");

  const [draft, setDraft] = useState<string>(documents.hasOtherIncome ?? "");

  const answersWith = (value: string): DocumentAnswers => ({
    ...documents,
    hasOtherIncome: value as YesNo,
  });

  const handleChange = (value: string) => {
    setDraft(value);
    revalidate(answersWith(value) as unknown as Record<string, unknown>);
  };

  const handleContinue = () =>
    submit(answersWith(draft) as unknown as Record<string, unknown>, () =>
      saveAndContinue(answersWith(draft)),
    );

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        description="For example, a second job, rent from a property, or support payments."
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          One question, so the heading asks it and the group carries no visible label.
          The radio group's ariaLabel repeats the heading because nothing else names
          it — GoabFormItem's label has no `for` and does not wrap its control.
        */}
        <GoabFormItem id="hasOtherIncome" type="radio-group" error={errorFor("hasOtherIncome")}>
          <GoabRadioGroup
            name="hasOtherIncome"
            ariaLabel={heading}
            value={draft}
            error={Boolean(errorFor("hasOtherIncome"))}
            onChange={(detail) => handleChange(String(detail.value))}
          >
            <GoabRadioItem value="yes" label="Yes" />
            <GoabRadioItem value="no" label="No" />
          </GoabRadioGroup>
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The page the "yes" opens.
 *
 * A text area rather than a single-line input, because the honest answer is often
 * more than one thing — a weekend job and a room rented out. Sizing a field to the
 * shortest plausible answer tells people to give the shortest plausible answer.
 */
function OtherIncomeDetailPage() {
  const {
    heading,
    documents,
    errors,
    errorFor,
    submit,
    revalidate,
    saveAndContinue,
    back,
    backLabel,
    continueLabel,
  } = useDocumentStep("other-income-detail");

  const [draft, setDraft] = useState<string>(documents.otherIncomeDetail ?? "");

  const answersWith = (value: string): DocumentAnswers => ({
    ...documents,
    otherIncomeDetail: value,
  });

  const handleChange = (value: string) => {
    setDraft(value);
    revalidate(answersWith(value) as unknown as Record<string, unknown>);
  };

  const handleContinue = () =>
    submit(answersWith(draft) as unknown as Record<string, unknown>, () =>
      saveAndContinue(answersWith(draft)),
    );

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        description="Tell us where the money comes from and roughly how much you receive."
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem id="otherIncomeDetail" error={errorFor("otherIncomeDetail")}>
          <GoabTextArea
            name="otherIncomeDetail"
            ariaLabel={heading}
            rows={4}
            width="100%"
            value={draft}
            error={Boolean(errorFor("otherIncomeDetail"))}
            onChange={(detail) => handleChange(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The task's check-answers page, and where the task actually finishes.
 *
 * The summary is the same component the whole-application review renders, told to
 * send its Change links back HERE rather than to /review — which is the reason the
 * return target is a named origin and not a constant. See lib/return-to.ts.
 */
function CheckPage() {
  return (
    <TaskReview section="documents">
      <DocumentsSummary returnTo="task" />
    </TaskReview>
  );
}

/**
 * Send someone entering the section to the first page still needing work, or to this
 * task's check page when nothing does — re-entering a finished section means looking
 * it over, and the page showing every answer at once is where looking starts.
 */
function SectionEntry() {
  const { state } = useForm();
  const next = firstIncompleteDocumentStep(state.documents);
  return <Navigate to={next ? stepPath(next, null) : DOCUMENTS_CHECK_PATH} replace />;
}

const PAGES: Record<DocumentStepId, () => ReactElement> = {
  "proof-of-income": ProofOfIncomePage,
  "other-income": OtherIncomePage,
  "other-income-detail": OtherIncomeDetailPage,
};

export function DocumentsSection() {
  return (
    <Routes>
      <Route index element={<SectionEntry />} />
      <Route path="check" element={<CheckPage />} />

      {DOCUMENT_STEP_IDS.map((id) => {
        const Page = PAGES[id];
        return <Route key={id} path={id} element={<Page />} />;
      })}

      {/* A hand-typed or stale URL lands on the section entry, not a broken page. */}
      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
