import { ReactNode, createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { GoabText, GoabLink } from "@abgov/react-components";
import type { ReturnTo } from "../lib/return-to";

/**
 * The review pattern in three pieces: FormSummary (a titled group), SummarySection (the
 * card, with one Change action for the group) and SummaryItem (one row). None of them
 * manages data. Change is section level: a person changing their address expects the
 * address page, not a single field.
 */

const FormSummaryContext = createContext<{ showUnanswered: boolean }>({
  showUnanswered: true,
});

function isEmptyAnswer(children: ReactNode): boolean {
  if (children == null || children === false || children === "") return true;
  if (typeof children === "string") return children.trim() === "";
  if (Array.isArray(children)) return children.length === 0;
  return false;
}

/** Where Change links come back to: the same summary appears on the review and on the task's check page. */
export type SummaryProps = { returnTo: ReturnTo };

/** An answer not yet given, so a half-finished application still shows its own shape. Reads the same as a skipped optional question. */
export const NotAnswered = () => (
  <span style={{ color: "var(--goa-color-text-secondary)" }}>Not answered</span>
);

export const answer = (value: string | undefined): ReactNode =>
  value && value.trim() !== "" ? value : <NotAnswered />;

type FormSummaryProps = {
  title?: string;
  showUnanswered?: boolean;
  children: ReactNode;
};

export function FormSummary({
  title,
  showUnanswered = true,
  children,
}: FormSummaryProps) {
  return (
    <FormSummaryContext.Provider value={{ showUnanswered }}>
      <div style={{ marginBottom: "var(--goa-space-l)" }}>
        {title && (
          // h2 by tag so the outline stays true under the h1; the smaller size is
          // deliberate, so section headings sit below the page title instead of beside it.
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
  heading?: string;
  changeTo?: string;
  onChange?: () => void;
  changeLabel?: string;
  /**
   * What this Change link changes, in the accessible name only: on screen every link
   * says "Change", but listed by a screen reader "Change, Change, Change" names nothing.
   */
  changeContext?: string;
  children: ReactNode;
};

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
      {/* Change sits beside the content, top-aligned, so a one-row card reads as one line. */}
      <div
        style={{ display: "flex", gap: "var(--goa-space-l)", alignItems: "flex-start" }}
      >
        <div style={{ flex: 1 }}>
          {heading && (
            /*
             * A real h3 drawn as the quiet label it replaced: a styled span put nothing
             * in the page outline, so someone navigating by heading had to read every
             * row. font: inherit undoes the browser's default h3 size and weight.
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
  question: string;
  optional?: boolean;
  children?: ReactNode;
};

export function SummaryItem({ question, optional, children }: SummaryItemProps) {
  const { showUnanswered } = useContext(FormSummaryContext);
  const empty = isEmptyAnswer(children);

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
