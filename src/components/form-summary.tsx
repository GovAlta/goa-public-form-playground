import { ReactNode, createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { GoabText, GoabLink } from "@abgov/react-components";

/**
 * The "review your answers" pattern, in three pieces:
 *
 *   FormSummary     a titled group of sections
 *   SummarySection  the card: optional heading, and one Change action for the group
 *   SummaryItem     one row: question on the left, answer on the right
 *
 * Each piece owns structure, spacing and layout. You pass the content in as children.
 * None of them manages data, which is what lets the same three components render a
 * screener's four answers and a whole application's review page.
 *
 * Change is section level, not row level. A person changing their address expects to
 * land on the address page, not on a single field.
 */

// showUnanswered is set once on FormSummary and read by every SummaryItem beneath it.
const FormSummaryContext = createContext<{ showUnanswered: boolean }>({ showUnanswered: true });

function isEmptyAnswer(children: ReactNode): boolean {
  if (children == null || children === false || children === "") return true;
  if (typeof children === "string") return children.trim() === "";
  if (Array.isArray(children)) return children.length === 0;
  return false;
}

type FormSummaryProps = {
  /** Section title (e.g. "My information"). Optional. */
  title?: string;
  /**
   * Whether unanswered optional questions render as "Not answered" (default) or are
   * hidden entirely. Showing them is usually right: a person should be able to see
   * what they chose to skip before they submit.
   */
  showUnanswered?: boolean;
  /** SummarySection cards. */
  children: ReactNode;
};

/** Top level: a titled group of summary sections. */
export function FormSummary({ title, showUnanswered = true, children }: FormSummaryProps) {
  return (
    <FormSummaryContext.Provider value={{ showUnanswered }}>
      <div style={{ marginBottom: "var(--goa-space-l)" }}>
        {title && (
          // An h2 by tag, deliberately, and a smaller one by size. The tag is what
          // puts the section in the page outline, so it has to stay h2 — dropping to
          // h3 to get the smaller type would skip a level under the h1 and make the
          // outline lie about the structure. `size` moves the type independently,
          // which is the whole reason the prop exists. At its default the section
          // headings render 32px against the h1's 40px and read almost as loud as the
          // page title, on a page whose job is the answers underneath them.
          <GoabText tag="h2" size="heading-m" mt="none" mb="s" color="secondary">
            {title}
          </GoabText>
        )}
        {children}
      </div>
    </FormSummaryContext.Provider>
  );
}

type SummarySectionProps = {
  /** Optional group heading (the grey "Heading for group of questions"). */
  heading?: string;
  /** Where the section's Change link goes (a route). Omit for a read-only section. */
  changeTo?: string;
  /** Change as an action instead of a route (e.g. to enter a change-from-review flow). */
  onChange?: () => void;
  /** Change link label. */
  changeLabel?: string;
  /**
   * What this Change link changes, announced but not shown.
   *
   * On screen every Change link says "Change", because a column of links reading
   * "Change where your other income comes from" is long, ragged, and squeezes the
   * answers beside it. Heard one at a time, though, or listed by a screen reader,
   * "Change, Change, Change" names nothing — and a review page is exactly where
   * someone is moving between links rather than reading top to bottom.
   *
   * So the target is in the accessible name and out of the layout. Both audiences
   * get the version that works for them, which is the only reason to hide text at
   * all: never to hide something from anyone, only to keep the visual and spoken
   * forms of the same thing from having to be identical.
   */
  changeContext?: string;
  /** SummaryItem rows. */
  children: ReactNode;
};

/** The card: one bordered group, an optional heading, one Change action for the group. */
export function SummarySection({
  heading,
  changeTo,
  onChange,
  changeLabel = "Change",
  changeContext,
  children,
}: SummarySectionProps) {
  const linkContent = (
    <>
      {changeLabel}
      {changeContext && <span className="pf-visually-hidden"> {changeContext}</span>}
    </>
  );

  return (
    <div
      style={{
        border: "1px solid var(--goa-color-greyscale-200)",
        borderRadius: "var(--goa-border-radius-xl)",
        padding: "var(--goa-space-m) var(--goa-space-l)",
        marginBottom: "var(--goa-space-m)",
      }}
    >
      {/* Change sits beside the content (top-right), not on its own line above it,
          so a single-row card reads as one line with no odd gap above the question.
          Change is section-level, so it aligns to the top of the group. mt/mb none
          zeroes GoabLink's default margins. */}
      <div style={{ display: "flex", gap: "var(--goa-space-l)", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {heading && (
            /*
             * A real heading, drawn to look exactly like the quiet label it replaced.
             *
             * It used to be a styled <span>, which looked right and put nothing in the
             * page outline: a review page went h1, h2 per section, then a run of cards
             * with no structure inside them at all. Someone navigating by heading — the
             * normal way to move around a long page without a mouse — could reach the
             * section and then had to read every row to find the group they wanted.
             *
             * h3 is the level, not a choice: it sits under the section's h2, and
             * skipping to h4 to borrow smaller type would make the outline lie. The
             * type is moved by CSS instead, which is the honest split. `font: inherit`
             * is what does it — a browser's default h3 is larger and bold, and this
             * needs to render as the same quiet grey label it has always been.
             *
             * A card without a name gets no heading at all rather than an empty one.
             * Only cards holding more than one answer are named; a card holding one
             * answer is labelled by the row itself.
             */
            <h3
              style={{
                margin: 0,
                marginBottom: "var(--goa-space-xs)",
                font: "inherit",
                color: "var(--goa-color-text-secondary)",
              }}
            >
              {heading}
            </h3>
          )}
          {children}
        </div>
        {(changeTo || onChange) && (
          <GoabLink mt="none" mb="none">
            {onChange ? (
              <a
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                onClick={onChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange();
                  }
                }}
              >
                {linkContent}
              </a>
            ) : (
              <Link to={changeTo!}>{linkContent}</Link>
            )}
          </GoabLink>
        )}
      </div>
    </div>
  );
}

type SummaryItemProps = {
  /** The question / field label (left column). */
  question: string;
  /**
   * Marks an optional question. When its answer is empty it renders "Not answered"
   * (or is hidden if the FormSummary's showUnanswered is off). Empty secondary
   * sub-fields are simply not passed in (developer-controlled), not marked optional.
   */
  optional?: boolean;
  /** The answer (right column): text, a paragraph, a list of selected options, a file link. */
  children?: ReactNode;
};

/** One row inside a section: question on the left, answer (slot) on the right. */
export function SummaryItem({ question, optional, children }: SummaryItemProps) {
  const { showUnanswered } = useContext(FormSummaryContext);
  const empty = isEmptyAnswer(children);

  // Optional + empty: hidden when the form turns unanswered display off; otherwise
  // a muted "Not answered" so the user sees what they chose to skip.
  if (optional && empty && !showUnanswered) return null;
  const answer =
    optional && empty ? (
      <span style={{ color: "var(--goa-color-text-secondary)" }}>Not answered</span>
    ) : (
      children
    );

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--goa-space-l)",
        alignItems: "baseline",
        padding: "var(--goa-space-xs) 0",
      }}
    >
      <span style={{ flex: "0 0 40%" }}>
        <strong>{question}</strong>
      </span>
      <span style={{ flex: 1 }}>{answer}</span>
    </div>
  );
}
