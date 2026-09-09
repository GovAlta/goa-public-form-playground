import { ReactNode } from "react";
import { GoabText, GoabCallout } from "@abgov/react-components";

type ResultsPageProps = {
  heading: string;
  status: "success" | "important";
  statusHeading: string;
  statusBody?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
};

/**
 * The terminal outcome screen: eligible, not eligible, or submitted. No back link and
 * it leads with a status Callout, so it renders in the app shell directly rather than
 * through PublicFormLayout.
 */
export function ResultsPage({
  heading,
  status,
  statusHeading,
  statusBody,
  children,
  actions,
}: ResultsPageProps) {
  return (
    <>
      <GoabText tag="h1" mt="none" mb="xl">
        {heading}
      </GoabText>

      {/* mb none: the next section's heading owns the gap, so the rhythm holds with or without a Callout body. */}
      <GoabCallout type={status} heading={statusHeading} mb="none">
        {statusBody}
      </GoabCallout>

      {children}

      <div style={{ marginTop: "var(--goa-space-2xl)" }}>{actions}</div>
    </>
  );
}

/**
 * The contact block on every result page. The bracketed values are placeholders:
 * replace them with your service's real contact details before shipping.
 */
export function ResultContactSection() {
  return (
    <>
      <GoabText tag="h2" mt="xl" mb="s">
        If you have questions about your application
      </GoabText>
      <GoabText mt="none" mb="s">
        Contact the [program area].
      </GoabText>
      <GoabText mt="none" mb="2xs">
        <strong>Email:</strong> [email address]
      </GoabText>
      <GoabText mt="none" mb="none">
        <strong>Phone:</strong> [phone number]
      </GoabText>
    </>
  );
}
