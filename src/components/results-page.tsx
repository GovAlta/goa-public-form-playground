import { ReactNode } from "react";
import { GoabText, GoabCallout } from "@abgov/react-components";

type ResultsPageProps = {
  /** The outcome statement (H1). */
  heading: string;
  /** Status colour: "success" for a positive outcome, "important" for a blocked one. */
  status: "success" | "important";
  /** The Callout heading — the headline status (often the specific reason). */
  statusHeading: string;
  /** Optional Callout body. */
  statusBody?: ReactNode;
  /** Content between the Callout and the actions (e.g. "what happens next", the contact block). */
  children?: ReactNode;
  /** The action button group. */
  actions: ReactNode;
};

/**
 * The terminal outcome screen: eligible, not eligible, or submitted.
 *
 * The inverse of a question page. A question page leads with a form and sits inside
 * PublicFormLayout, which gives it a back link. A result page is the end of the
 * road, so it has no back link and leads with a status Callout. It renders directly
 * inside the app shell rather than through PublicFormLayout.
 *
 * The anatomy is fixed: outcome heading, status Callout, optional content, actions.
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

      {/* mb none: the next section's heading owns the gap (mt xl), so sections
          sit on one consistent rhythm whether or not a Callout body is present. */}
      <GoabCallout type={status} heading={statusHeading} mb="none">
        {statusBody}
      </GoabCallout>

      {children}

      <div style={{ marginTop: "var(--goa-space-2xl)" }}>{actions}</div>
    </>
  );
}

/**
 * The contact block that repeats on every result page.
 *
 * The values below are placeholders in square brackets on purpose. Replace them with
 * your service's real contact details. Never ship a template's contact details as
 * your own: someone else's inbox will receive your users.
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
