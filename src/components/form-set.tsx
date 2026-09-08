import { ReactNode } from "react";
import { GoabText, GoabButton, GoabButtonGroup } from "@abgov/react-components";
import { ErrorSummary, useErrorSummaryFocus } from "./error-summary";
import type { FieldError } from "../lib/validation";

type FormSetProps = {
  /**
   * The page's heading: the section name, or the question itself when the page asks
   * only one thing.
   *
   * Required, and that is the point. It used to be optional, on the theory that a
   * lone question could skip it and let the field's own label at labelSize="large"
   * serve as the heading. It cannot: that renders a <label>, styled to look like a
   * heading. Those pages shipped with no <h1> at all, which is presentation standing
   * in for structure — the thing screen reader users navigating by heading rely on,
   * gone, while the page looks perfect. Making this required is what stops the
   * shortcut being available again.
   */
  heading: string;
  /** Supporting content shown below the heading. */
  description?: ReactNode;
  /** The field(s). */
  children: ReactNode;
  /** Primary action label. Defaults to "Continue". */
  continueLabel?: string;
  /** Runs when the primary action is pressed (the page owns validation + navigation). */
  onContinue?: () => void;
  /**
   * Validation errors. When non-empty, renders the error summary above the
   * fields and moves focus to it on a fresh failed submit. The page owns the
   * rules and sets matching field-level errors.
   */
  errors?: FieldError[];
};

/**
 * The form content unit shared by every question page. Renders an optional heading,
 * the error summary, the fields, and the continue button, and owns two things you do
 * not want each page deciding for itself:
 *
 *  - the vertical rhythm (heading -> description -> fields -> button)
 *  - where the error summary sits, and moving focus to it on a failed submit
 *
 * Two shapes, and both now carry a real heading:
 *  - Lone single question: `heading` is the question. The field is given no visible
 *    label, since the heading already asks it, and the control carries the same words
 *    as its accessible name.
 *  - Section, or several questions on a page: `heading` names the section and each
 *    field has its own label.
 *
 * A note on where a field's accessible name actually comes from, because it is not
 * where it looks. GoabFormItem renders its label with no `for` attribute and without
 * wrapping the control, so that label names nothing — it is visible text. The name
 * assistive technology reads is the control's own `ariaLabel`. That makes the visible
 * label and the announced name two separate strings, which can drift apart silently.
 * Keep them the same words, and when a page has no visible label, the control's
 * ariaLabel is doing all of the work.
 *
 * The back link and app shell are deliberately not here. They live in
 * PublicFormLayout and App.
 */
export function FormSet({
  heading,
  description,
  children,
  continueLabel = "Continue",
  onContinue,
  errors = [],
}: FormSetProps) {
  // Focus the summary on a fresh failed submit (empty -> non-empty), not while the
  // user is live-clearing errors as they fix them.
  const summaryRef = useErrorSummaryFocus(errors);

  return (
    <>
      <GoabText tag="h1" mt="none" mb={description ? "m" : "xl"}>
        {heading}
      </GoabText>
      {description && (
        <GoabText mt="none" mb="xl">
          {description}
        </GoabText>
      )}

      <ErrorSummary ref={summaryRef} errors={errors} />

      {children}

      <GoabButtonGroup alignment="start" mt="2xl">
        <GoabButton type="primary" onClick={onContinue}>
          {continueLabel}
        </GoabButton>
      </GoabButtonGroup>
    </>
  );
}
