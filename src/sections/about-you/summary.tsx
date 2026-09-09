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
import { formatDate, formatPhone, formatAddressLines } from "../../lib/format";
import { ABOUT_YOU_STEPS, ABOUT_YOU_STEP_IDS } from "./rules";

/** What each Change link changes, in its accessible name: destinations rather than page headings. */
const CHANGE_CONTEXT = {
  name: "your name",
  "date-of-birth": "your date of birth",
  contact: "your contact details",
  address: "your address",
} as const;

export function AboutYouSummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const a = state.aboutYou;

  /*
   * A heading only where the card holds more than one answer; a one-answer card headed
   * with its question would say it twice. Written out rather than generated from the
   * step's fields, because a field name is not a row label and an address is one answer.
   */
  const cards: Record<
    (typeof ABOUT_YOU_STEP_IDS)[number],
    { heading?: string; rows: ReactNode }
  > = {
    name: {
      heading: ABOUT_YOU_STEPS.name.heading,
      rows: (
        <>
          <SummaryItem question="First name">{answer(a.firstName)}</SummaryItem>
          <SummaryItem question="Last name">{answer(a.lastName)}</SummaryItem>
        </>
      ),
    },
    "date-of-birth": {
      rows: (
        <SummaryItem question={ABOUT_YOU_STEPS["date-of-birth"].heading}>
          {answer(formatDate(a.dateOfBirth))}
        </SummaryItem>
      ),
    },
    contact: {
      heading: ABOUT_YOU_STEPS.contact.heading,
      rows: (
        <>
          <SummaryItem question="Phone number">
            {answer(formatPhone(a.phone))}
          </SummaryItem>
          {/* `optional` makes an empty answer read as a choice, not as work outstanding. */}
          <SummaryItem question="Email address" optional>
            {a.email}
          </SummaryItem>
        </>
      ),
    },
    address: {
      rows: (
        <SummaryItem question={ABOUT_YOU_STEPS.address.heading}>
          {formatAddressLines(a).length > 0 ? (
            formatAddressLines(a).map((line) => <div key={line}>{line}</div>)
          ) : (
            <NotAnswered />
          )}
        </SummaryItem>
      ),
    },
  };

  return (
    <FormSummary title="About you">
      {ABOUT_YOU_STEP_IDS.map((step) => (
        <SummarySection
          key={step}
          heading={cards[step].heading}
          changeTo={withReturnTo(`/about-you/${step}`, returnTo)}
          changeContext={CHANGE_CONTEXT[step]}
        >
          {cards[step].rows}
        </SummarySection>
      ))}
    </FormSummary>
  );
}
