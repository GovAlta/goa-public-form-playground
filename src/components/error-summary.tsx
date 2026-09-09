import { forwardRef, useEffect, useRef } from "react";
import { GoabIcon, GoabText } from "@abgov/react-components";
import type { FieldError } from "../lib/validation";

const FOCUSABLE = "input, select, textarea, button, [tabindex]:not([tabindex='-1'])";

// GoA controls render their real input inside the web component's shadow DOM (the date
// picker one level deeper), so this walks light DOM and open shadow roots.
function findFocusable(node: ParentNode): HTMLElement | null {
  for (const child of Array.from(node.children)) {
    const el = child as HTMLElement;
    if (el.matches(FOCUSABLE)) return el;
    const inLight = findFocusable(el);
    if (inLight) return inLight;
    if (el.shadowRoot) {
      const inShadow = findFocusable(el.shadowRoot);
      if (inShadow) return inShadow;
    }
  }
  return null;
}

/**
 * Error summary for a question page ("There is a problem"): every error as a link that
 * jumps to and focuses its field, paired with the inline error on the field. Not a
 * Callout, because Callouts are for guidance and errors would read as advice.
 * Rendered and focus-managed by FormSet.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: FieldError[] }>(
  function ErrorSummary({ errors }, ref) {
    if (errors.length === 0) return null;

    const jumpToField = (fieldId: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const formItem = document.getElementById(fieldId);
      if (!formItem) return;
      formItem.scrollIntoView({ behavior: "smooth", block: "center" });
      findFocusable(formItem)?.focus({ preventScroll: true });
    };

    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        aria-labelledby="error-summary-title"
        style={{
          backgroundColor: "var(--goa-color-emergency-background)",
          border: "1px solid var(--goa-color-emergency-default)",
          borderRadius: "var(--goa-border-radius-m)",
          padding: "var(--goa-space-l)",
          marginBottom: "var(--goa-space-xl)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--goa-space-xs)",
            marginBottom: "var(--goa-space-s)",
          }}
        >
          <GoabIcon
            type="warning"
            theme="filled"
            fillColor="var(--goa-color-emergency-default)"
            ariaLabel=""
          />
          <GoabText
            id="error-summary-title"
            tag="h2"
            size="heading-s"
            mt="none"
            mb="none"
          >
            There is a problem
          </GoabText>
        </div>

        <ul style={{ margin: 0, paddingLeft: "var(--goa-space-l)" }}>
          {errors.map((err) => (
            <li key={err.fieldId} style={{ marginBottom: "var(--goa-space-2xs)" }}>
              <a
                href={`#${err.fieldId}`}
                onClick={jumpToField(err.fieldId)}
                style={{
                  color: "var(--goa-color-emergency-dark)",
                  textDecoration: "underline",
                }}
              >
                {err.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

/**
 * Focus the error summary when it first appears, so keyboard and screen-reader users
 * land on it after a failed submit. Returns the ref to put on <ErrorSummary>.
 */
export function useErrorSummaryFocus(errors: FieldError[]) {
  const ref = useRef<HTMLDivElement>(null);
  const had = useRef(false);
  useEffect(() => {
    const has = errors.length > 0;
    if (has && !had.current) ref.current?.focus();
    had.current = has;
  }, [errors]);
  return ref;
}
