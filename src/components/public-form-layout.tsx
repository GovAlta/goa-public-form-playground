import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GoabLink } from "@abgov/react-components";

type PublicFormLayoutProps = {
  /** Where the back link navigates (a route). Defaults to the task list at "/". */
  back?: string;
  /** Back link text. Defaults to "Back". */
  backLabel?: string;
  /**
   * Back as an action instead of a route (e.g. "Back to review" cancelling a
   * change-from-review flow). Takes precedence over `back` when set.
   */
  onBack?: () => void;
  /** The page content, typically a <FormSet>. */
  children: ReactNode;
};

/**
 * Question page layout.
 *
 * Owns the page concerns that sit outside the form itself: the back link, and the
 * spacing between the back link and the content. The form content lives in
 * <FormSet>; the app shell (header, content column, footer) lives in App.
 *
 * Three layers, each with one job. Keeping them separate is what stops every page
 * re-specifying its own spacing and drifting apart.
 */
export function PublicFormLayout({
  back = "/",
  backLabel = "Back",
  onBack,
  children,
}: PublicFormLayoutProps) {
  return (
    <>
      <GoabLink leadingIcon="arrow-back" size="small" color="dark" mb="none">
        {onBack ? (
          <a
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={onBack}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onBack();
              }
            }}
          >
            {backLabel}
          </a>
        ) : (
          <Link to={back}>{backLabel}</Link>
        )}
      </GoabLink>

      {/* xl gap is the canonical back-link -> heading rhythm; the first child sits
          flush (mt none) so the gap is exactly this. */}
      <div style={{ marginTop: "var(--goa-space-xl)" }}>{children}</div>
    </>
  );
}
