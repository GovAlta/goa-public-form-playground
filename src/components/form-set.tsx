import { ReactNode } from "react";
import { GoabText, GoabButton, GoabButtonGroup } from "@abgov/react-components";
import { ErrorSummary, useErrorSummaryFocus } from "./error-summary";
import type { FieldError } from "../lib/validation";

type FormSetProps = {
  /**
   * The page's heading: the section name, or the question itself when the page asks
   * one thing. Required: a large field label is a <label>, not a heading, and pages
   * that leaned on one shipped with no h1.
   */
  heading: string;
  description?: ReactNode;
  children: ReactNode;
  continueLabel?: string;
  onContinue?: () => void;
  errors?: FieldError[];
};

/**
 * The form content unit shared by every question page: heading, error summary, fields,
 * continue button. It owns the vertical rhythm and the error summary's placement and
 * focus. A lone question uses `heading` as the question and gives the field no visible
 * label. Keep a control's ariaLabel the same words as its visible label: the ariaLabel
 * is what gets announced, and the two drift apart silently.
 */
export function FormSet({
  heading,
  description,
  children,
  continueLabel = "Continue",
  onContinue,
  errors = [],
}: FormSetProps) {
  // Focus the summary on a fresh failed submit, not while errors clear as they are fixed.
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
