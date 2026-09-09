import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoabText, GoabCallout, GoabButton, GoabLink } from "@abgov/react-components";
import { useForm } from "../store/form-store";
import { submitApplication } from "../store/submission";
import { incompleteSections, sectionById, type SectionId } from "../lib/sections";
import { EligibilitySummary } from "../sections/eligibility/summary";
import { AboutYouSummary } from "../sections/about-you/summary";
import { YourChildrenSummary } from "../sections/your-children/summary";
import { DocumentsSummary } from "../sections/documents/summary";

/**
 * Check your answers, and send the application: the check over the whole application,
 * where each task's own check page is the check over one. This page owns what is still
 * outstanding and the declaration and submit; the cards are each section's summary.tsx in src/sections.
 */
export function ReviewPage() {
  const { state, recordSubmission } = useForm();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const outstanding = incompleteSections(state);
  const ready = outstanding.length === 0;
  const unlocked = (id: SectionId) => sectionById(id).isUnlocked(state);

  async function handleSubmit() {
    // Guarded: a second click before the first finishes would submit twice. The one
    // control closed off in the form, and only for the duration of the action.
    if (sending) return;
    setSending(true);

    // No try/catch, and a fork has to add one: what a person sees when a real submit
    // fails is a design question for the service. See store/submission.ts.
    const receipt = await submitApplication(state);
    await recordSubmission(receipt);
    navigate("/confirmation");
  }

  return (
    <div>
      <GoabText tag="h1" mt="none" mb="l">
        Check your answers
      </GoabText>

      {/* Arriving unfinished is normal, not an error: the task list's button is always
          live, and this page says what is left, by name, each one a link. */}
      {!ready && (
        <GoabCallout type="important" heading="You cannot submit this yet" mb="xl">
          <GoabText mt="none" mb="s">
            {outstanding.length === 1
              ? "One part of your application is unfinished:"
              : `${outstanding.length} parts of your application are unfinished:`}
          </GoabText>
          <ul style={{ margin: 0, paddingLeft: "var(--goa-space-l)" }}>
            {outstanding.map((section) => (
              <li key={section.id} style={{ marginBottom: "var(--goa-space-2xs)" }}>
                {/* A locked section is listed but not linked: a link to a page they cannot
                    open yet invites them to try. The task list makes the same distinction. */}
                {section.isUnlocked(state) ? (
                  <GoabLink mt="none" mb="none">
                    <Link
                      to={section.route}
                    >{`Finish ${section.title.toLowerCase()}`}</Link>
                  </GoabLink>
                ) : (
                  <span style={{ color: "var(--goa-color-text-secondary)" }}>
                    {section.title} — check if you can apply first
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GoabCallout>
      )}

      {/* A locked section is not shown at all: cards of "Not answered" with Change links
          into a section the person cannot open would contradict the task list. */}
      <EligibilitySummary returnTo="review" />
      {unlocked("about-you") && <AboutYouSummary returnTo="review" />}
      {unlocked("your-children") && <YourChildrenSummary />}
      {unlocked("documents") && <DocumentsSummary returnTo="review" />}

      {ready && (
        <>
          {/* The same size as the section headings: a peer in the outline, not the loudest thing on the page. */}
          <GoabText tag="h2" size="heading-m" mt="2xl" mb="s">
            Now send your application
          </GoabText>
          {/* No "I agree" checkbox: the agreement is in the button's own words. The wording
              below is a placeholder; what a person agrees to is your program's to decide. */}
          <GoabText mt="none" mb="xl">
            By submitting this application you confirm that the information you have given
            is true and complete. [Replace this with your program's declaration.]
          </GoabText>
          <GoabButton type="primary" onClick={handleSubmit}>
            Agree and submit
          </GoabButton>
        </>
      )}
    </div>
  );
}
