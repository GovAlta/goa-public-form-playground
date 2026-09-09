import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GoabLink } from "@abgov/react-components";

type PublicFormLayoutProps = {
  back?: string;
  backLabel?: string;
  onBack?: () => void;
  children: ReactNode;
};

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

      {/* xl is the back-link to heading rhythm; the first child sits flush so the gap is exactly this. */}
      <div style={{ marginTop: "var(--goa-space-xl)" }}>{children}</div>
    </>
  );
}
