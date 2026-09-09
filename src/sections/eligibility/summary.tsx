// This section's answers shown back, on the review page and on its own check page. One
// card per question page, so a Change link lands on the page that asked; see docs/design-notes.md.
import {
  FormSummary,
  SummarySection,
  SummaryItem,
  answer,
  type SummaryProps,
} from "../../components/form-summary";
import { useForm } from "../../store/form-store";
import { withReturnTo } from "../../lib/return-to";
import { formatYesNo } from "../../lib/format";
import { STEPS, reachable } from "./rules";

/** What each Change link changes, in its accessible name: destinations rather than page headings. */
const CHANGE_CONTEXT = {
  age: "your age",
  residency: "where you live",
  otherSupport: "other program support",
  otherSupportDetail: "the program name",
} as const;

export function EligibilitySummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const answers = state.eligibility;
  // Only the questions this person was asked: the screener branches.
  const asked = reachable(answers);

  return (
    <FormSummary title="Check if you can apply">
      {[...asked].map((step) => (
        <SummarySection
          key={step}
          changeTo={withReturnTo(`/eligibility/${step}`, returnTo)}
          changeContext={CHANGE_CONTEXT[step]}
        >
          <SummaryItem question={STEPS[step].heading}>
            {step === "otherSupportDetail"
              ? answer(answers.otherSupportDetail)
              : answer(formatYesNo(answers[step]))}
          </SummaryItem>
        </SummarySection>
      ))}
    </FormSummary>
  );
}
