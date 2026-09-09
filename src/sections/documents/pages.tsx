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
import { DocumentsSummary } from "./summary";
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
} from "./rules";
import type { DocumentAnswers, YesNo } from "../../lib/form-state";
import {
  RETURN_LABELS,
  readReturnTo,
  withReturnTo,
  type ReturnTo,
} from "../../lib/return-to";
import { newId, useForm } from "../../store/form-store";

/**
 * Income and documents: proof of income, whether there is other income, and what it is.
 * Three pages rather than two with a reveal; the reasoning is in rules.ts.
 */

const SECTION_ROOT = "/documents";

export const DOCUMENTS_CHECK_PATH = `${SECTION_ROOT}/check`;

const RETURN_PATHS = {
  review: "/review",
  task: DOCUMENTS_CHECK_PATH,
} as const;

const SUPPORTED = ["review", "task"] as const;

const stepPath = (step: DocumentStepId, returnTo: ReturnTo | null) =>
  withReturnTo(`${SECTION_ROOT}/${step}`, returnTo);

/** Set false and a second upload replaces the first; see addDocument in rules.ts. */
const ACCEPTS_MULTIPLE_FILES = true;

function useDocumentStep(step: DocumentStepId) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const config = DOCUMENT_STEPS[step];

  const returnTo = readReturnTo(params, SUPPORTED);

  const { errors, submit, revalidate } = useFormValidation(config.schema);

  /** Save this page's answer, pruned so an answer the new path no longer reaches cannot reappear. */
  const saveAndContinue = (answers: DocumentAnswers) => {
    const saved = pruneDocuments(answers);
    dispatch({ type: "save-documents", answers: saved });

    const next = resolveNextDocumentStep(step, saved);
    if ("question" in next) {
      navigate(stepPath(next.question, returnTo));
      return;
    }
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

/**
 * Uploads commit on the action, not on Continue: an upload is a completed act with a
 * visible result, and in a real service the bytes have already left the browser.
 * GoabFileUploadInput takes no error prop, so the dropzone itself cannot turn red.
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
    revalidate({ ...documents, proofOfIncome: next } as unknown as Record<
      string,
      unknown
    >);
  };

  const handleSelect = (detail: { file: File }) =>
    saveFiles(
      addDocument(
        files,
        toUploadedDocument(newId(), detail.file),
        ACCEPTS_MULTIPLE_FILES,
      ),
    );

  const handleDelete = (id: string) => saveFiles(removeDocument(files, id));

  const handleContinue = () =>
    submit(documents as unknown as Record<string, unknown>, () =>
      saveAndContinue(documents),
    );

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
          // The dropzone already states the size limit; help text adds what it does not say.
          helpText="You can upload JPG, PNG or PDF files."
          error={errorFor("proofOfIncome")}
        >
          <GoabFileUploadInput
            variant="dragdrop"
            accept=".jpg,.jpeg,.png,.pdf"
            maxFileSize="10MB"
            onSelectFile={handleSelect}
          />

          {/* Cards below the drop area, so the control does not move down the page with each file. */}
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
        {/* One question: the heading asks it, so no visible label; the group's ariaLabel
            carries the heading, since nothing else here names the group. */}
        <GoabFormItem
          id="hasOtherIncome"
          type="radio-group"
          error={errorFor("hasOtherIncome")}
        >
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

/** The page a "yes" opens. A text area, not a single-line input: a field sized to the shortest answer asks for the shortest answer. */
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

function CheckPage() {
  return (
    <TaskReview section="documents">
      <DocumentsSummary returnTo="task" />
    </TaskReview>
  );
}

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

      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
