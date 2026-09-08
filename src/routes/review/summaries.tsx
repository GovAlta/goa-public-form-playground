import { ReactNode } from "react";
import { FormSummary, SummarySection, SummaryItem } from "../../components/form-summary";
import { RepeatingGroupSummary } from "../../components/repeating-group-summary";
import { useForm } from "../../store/form-store";
import { withReturnTo, type ReturnTo } from "../../lib/return-to";
import { STEPS as ELIGIBILITY_STEPS, reachable } from "../../lib/eligibility";
import { ABOUT_YOU_STEPS, ABOUT_YOU_STEP_IDS } from "../../lib/about-you";
import { DOCUMENT_STEPS, reachableDocumentSteps } from "../../lib/documents";
import { childLabel, isChildComplete } from "../../lib/your-children";
import {
  formatDate,
  formatYesNo,
  formatPhone,
  formatFileSize,
  formatAddressLines,
} from "../../lib/format";

/**
 * Each section's answers, shown back.
 *
 * Written once and rendered on two different pages: the whole application's review
 * (routes/review/review-page.tsx) shows all four, and each task's own check-answers
 * page shows one. That is the only reason this is a file of its own — a second copy
 * of "how About you reads back" is a second copy that drifts.
 *
 * ONE CARD PER PAGE, NOT ONE CARD PER SECTION. This is the rule the summaries are
 * built on and the easiest thing to get wrong. A Change link has to land somewhere
 * that looks like what the person clicked: someone changing their postal code and
 * arriving on a page headed "What is your name?" thinks they clicked the wrong link,
 * and someone changing a name and landing on a page of five fields has to hunt for
 * the one they meant. So About you is four cards here because it is four pages there,
 * and each card's heading is that page's own heading.
 *
 * Which means the routes cannot be typed out by hand. Every Change link below is
 * built from the same step definitions the question pages are built from, so a page
 * that gets renamed, split or reordered takes its Change link with it. Only the row
 * labels and the way each answer reads are written out here, because those are the
 * content of the page rather than a fact about the flow, and a template's review page
 * is a thing people read to learn how theirs should look.
 *
 * A NOTE ON WHERE THESE COULD LIVE INSTEAD. Each summary arguably belongs to its own
 * section folder, beside the questions it shows back — that is the decomposition a
 * fork adding a fifth section would find easiest to copy. They are together instead
 * because the rule above is the thing most worth reading, and it is only visible when
 * the four are side by side: About you is the case where a card earns a heading, and
 * Income and documents is the case where it does not.
 */

/**
 * Where these cards' Change links come back to.
 *
 * Not a constant, because the same summary appears on two pages. A Change link
 * clicked on the whole-application review has to return there, and the same link
 * clicked on the task's own check page has to return THERE — sending someone to a
 * different page from the one they started on breaks the same "arrive on a page that
 * matches the link you clicked" rule the cards themselves are built to keep.
 */
export type SummaryProps = { returnTo: ReturnTo };

/**
 * What each Change link changes — announced, not shown.
 *
 * Every link reads "Change" on screen. Spelling the target out visibly made a ragged
 * column of long links ("Change where your other income comes from") that also ate
 * the width the answers needed, because the link and the content share a row.
 *
 * But "Change, Change, Change" is useless to anyone meeting the links on their own —
 * tabbing through, or listing them — and a review page is exactly where people move
 * between links rather than read top to bottom. So the target rides in the accessible
 * name instead of the layout. See SummarySection's changeContext.
 *
 * Written out rather than built from the page headings, because a heading is a
 * question ("Are you 18 or older?") and this is a destination ("your age").
 */
const CHANGE_CONTEXT = {
  age: "your age",
  residency: "where you live",
  otherSupport: "other program support",
  otherSupportDetail: "the program name",
  name: "your name",
  "date-of-birth": "your date of birth",
  contact: "your contact details",
  address: "your address",
  "proof-of-income": "your proof of income",
  "other-income": "whether you have other income",
  "other-income-detail": "where your other income comes from",
} as const;

/**
 * An answer that has not been given.
 *
 * Only reachable while the application is incomplete: once every section is complete
 * no required answer is empty, by definition. It exists so a half-finished
 * application still shows its own shape — a review page that silently omitted the
 * rows a person had not reached yet would look like their answers had gone missing,
 * which is the one thing a form promising "your progress is saved" must never look
 * like.
 *
 * It matches what SummaryItem renders for a skipped optional question, which is
 * deliberate. The two mean different things to whoever wrote the form, and exactly
 * the same thing to the person reading it: there is nothing here.
 */
const NotAnswered = () => (
  <span style={{ color: "var(--goa-color-text-secondary)" }}>Not answered</span>
);

/** A written answer, or the placeholder when it is still blank. */
const answer = (value: string | undefined): ReactNode =>
  value && value.trim() !== "" ? value : <NotAnswered />;

/* -------------------------------------------------------------------------- */
/* The sections                                                                */
/* -------------------------------------------------------------------------- */

export function EligibilitySummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const answers = state.eligibility;
  // Only the questions this person was actually asked. The screener branches, so
  // showing an unreachable question would be showing them a question they never saw.
  const asked = reachable(answers);

  return (
    <FormSummary title="Check if you can apply">
      {[...asked].map((step) => (
        <SummarySection
          key={step}
          changeTo={withReturnTo(`/eligibility/${step}`, returnTo)}
          changeContext={CHANGE_CONTEXT[step]}
        >
          <SummaryItem question={ELIGIBILITY_STEPS[step].heading}>
            {step === "otherSupportDetail"
              ? answer(answers.otherSupportDetail)
              : answer(formatYesNo(answers[step]))}
          </SummaryItem>
        </SummarySection>
      ))}
    </FormSummary>
  );
}

export function AboutYouSummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const a = state.aboutYou;

  /*
   * The card for each page.
   *
   * A HEADING ONLY WHERE THE CARD HOLDS MORE THAN ONE ANSWER. A page asking one thing
   * would otherwise say it twice — the card headed "What is your date of birth?" over
   * a row labelled "Date of birth" — and the second label is not a smaller heading,
   * it is the same question again. Where the card holds one answer, the page's own
   * question is that answer's label and there is no heading above it.
   *
   * Written out rather than generated from the step's `fields` list, because a field
   * name is not a row label ("postalCode" is not "Postal code" by any rule worth
   * writing) and an address is one answer across five fields rather than five answers.
   */
  const cards: Record<(typeof ABOUT_YOU_STEP_IDS)[number], { heading?: string; rows: ReactNode }> =
    {
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
            <SummaryItem question="Phone number">{answer(formatPhone(a.phone))}</SummaryItem>
            {/* The one optional answer in the service. `optional` is what makes an empty
                one read as a choice rather than as work outstanding. */}
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

export function YourChildrenSummary() {
  const { state } = useForm();

  return (
    <FormSummary title="Your children">
      {/*
        A repeating group collapses to each item's identifying field and one Change
        back to the list, rather than every child's every answer. Four children at
        five answers each is thirty rows of somebody else's application to read past,
        and what the person is confirming here is that the right people are listed.

        The Change link carries no ?from=review: the list is where children are
        managed, and it already returns to the task list. Sending someone back to
        review from a page where they might add three more children would be
        answering a question they had not finished asking.
      */}
      {/* No title on the card: the section heading above it already says whose
          children these are, and a second label would be read as part of the first. */}
      <RepeatingGroupSummary
        items={state.children.map((child) => ({
          id: child.id,
          label: childLabel(child),
          detail: isChildComplete(child) ? formatDate(child.dateOfBirth) : "Not finished",
        }))}
        emptyText="No children added"
        changeTo="/your-children"
        changeContext="your children"
      />
    </FormSummary>
  );
}

export function DocumentsSummary({ returnTo }: SummaryProps) {
  const { state } = useForm();
  const d = state.documents;
  const asked = reachableDocumentSteps(d);

  // Every page in this section asks one thing, so each page's own question is the
  // label for its answer and no card carries a heading above it. See About you for
  // the rule and the case where a heading does earn its place.
  const rows: Record<string, ReactNode> = {
    "proof-of-income": (
      <SummaryItem question={DOCUMENT_STEPS["proof-of-income"].heading}>
        {d.proofOfIncome.length === 0 ? (
          <NotAnswered />
        ) : (
          // Each file on its own line with its size, which is how a person tells two
          // similarly named documents apart.
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
