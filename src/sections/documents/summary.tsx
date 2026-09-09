// This section's answers shown back, on the review page and on its own check page. One
// card per question page, so a Change link lands on the page that asked; see docs/design-notes.md.
import { ReactNode } from "react";
import {
  FormSummary,
  SummarySection,
  SummaryItem,
  NotAnswered,
  answer,
  type SummaryProps,
} from "../../components/form-summary";
import { useForm } from "../../store/form-store";
import { withReturnTo } from "../../lib/return-to";
import { formatYesNo, formatFileSize } from "../../lib/format";
import { DOCUMENT_STEPS, reachableDocumentSteps } from "./rules";

/** What each Change link changes, in its accessible name: destinations rather than page headings. */
const CHANGE_CONTEXT = {
  "proof-of-income": "your proof of income",
  "other-income": "whether you have other income",
  "other-income-detail": "where your other income comes from",
} as const;

export function DocumentsSummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const d = state.documents;
  const asked = reachableDocumentSteps(d);

  // Every page here asks one thing, so no card carries a heading; see About you for the rule.
  const rows: Record<string, ReactNode> = {
    "proof-of-income": (
      <SummaryItem question={DOCUMENT_STEPS["proof-of-income"].heading}>
        {d.proofOfIncome.length === 0 ? (
          <NotAnswered />
        ) : (
          // Each file with its size, which is how two similarly named documents are told apart.
          d.proofOfIncome.map((file) => (
            <div key={file.id}>
              {file.name}{" "}
              <span style={{ color: "var(--goa-color-text-secondary)" }}>
                ({formatFileSize(file.size)})
              </span>
            </div>
          ))
        )}
      </SummaryItem>
    ),
    "other-income": (
      <SummaryItem question={DOCUMENT_STEPS["other-income"].heading}>
        {answer(formatYesNo(d.hasOtherIncome))}
      </SummaryItem>
    ),
    "other-income-detail": (
      <SummaryItem question={DOCUMENT_STEPS["other-income-detail"].heading}>
        {answer(d.otherIncomeDetail)}
      </SummaryItem>
    ),
  };

  return (
    <FormSummary title="Income and documents">
      {[...asked].map((step) => (
        <SummarySection
          key={step}
          changeTo={withReturnTo(`/documents/${step}`, returnTo)}
          changeContext={CHANGE_CONTEXT[step]}
        >
          {rows[step]}
        </SummarySection>
      ))}
    </FormSummary>
  );
}
