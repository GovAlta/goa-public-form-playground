import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoabText, GoabCallout, GoabButton, GoabLink } from "@abgov/react-components";
import { useForm } from "../../store/form-store";
import { submitApplication } from "../../store/submission";
import { incompleteSections, sectionById, type SectionId } from "../../lib/sections";
import {
  EligibilitySummary,
  AboutYouSummary,
  YourChildrenSummary,
  DocumentsSummary,
} from "./summaries";

/**
 * Check your answers, and send the application.
 *
 * The second of two tiers, and the distinction is the whole design. Each task has its
 * own check-answers page, which is where that task finishes; this is the check over
 * the WHOLE application, which is where it is sent. A person meets the first one four
 * times and this one once.
 *
 * So this page owns exactly two things the per-task pages do not: what is still
 * outstanding across the whole application, and the declaration and the submit. The
 * cards themselves are the same components either page renders — see ./summaries.tsx
 * for the rule they are built on.
 */

/* -------------------------------------------------------------------------- */
/* The page                                                                    */
/* -------------------------------------------------------------------------- */

export function ReviewPage() {
  const { state, dispatch } = useForm();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const outstanding = incompleteSections(state);
  const ready = outstanding.length === 0;
  const unlocked = (id: SectionId) => sectionById(id).isUnlocked(state);

  async function handleSubmit() {
    // Guarded because a second click before the first finishes would submit twice. A
    // real service returning a real reference makes that two applications. This is
    // the one place in the form where a control is closed off, and it is closed off
    // for the duration of an action rather than as a standing state.
    if (sending) return;
    setSending(true);

    // No try/catch here on purpose, and it is a gap a fork has to close rather than a
    // decision: this implementation cannot fail. What a person sees when a real
    // submit fails is a design question for the service, and it is raised at the seam
    // in store/submission.ts, where the fetch that can fail will live.
    const receipt = await submitApplication(state);
    dispatch({ type: "submit", at: receipt.submittedAt, reference: receipt.reference });
    navigate("/confirmation");
  }

  return (
    <div>
      <GoabText tag="h1" mt="none" mb="l">
        Check your answers
      </GoabText>

      {/*
        Arriving here unfinished is a normal thing to do, not an error. The button on
        the task list is live whether or not the application is complete, because a
        control that is greyed out tells nobody why, cannot be focused, and looks
        broken rather than blocked. So this page owns the explanation: what is left,
        by name, each one a link to the part that is missing.
      */}
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
                {/* A locked section is still a reason this cannot be submitted, so it
                    is still listed — but it is not a link, because a link to a page
                    the person is not allowed to open yet is an invitation to try. The
                    task list makes exactly the same distinction, with the same words. */}
                {section.isUnlocked(state) ? (
                  <GoabLink mt="none" mb="none">
                    <Link to={section.route}>{`Finish ${section.title.toLowerCase()}`}</Link>
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

      {/*
        A locked section is not shown at all.

        Before the screener passes, the rest of the application is shut: the task list
        greys those rows out and does not link them. Showing them here as cards full
        of "Not answered", each with a Change link into a section the person is not
        allowed to open, contradicts the task list and offers a way in that the
        service does not intend. A person who has answered nothing should see the one
        thing they can act on, not a preview of the whole application.

        Asked of each section rather than assuming they share one gate, so a section
        that later unlocks on something else is handled by having said so in
        lib/sections.ts.
      */}
      <EligibilitySummary returnTo="review" />
      {unlocked("about-you") && <AboutYouSummary returnTo="review" />}
      {unlocked("your-children") && <YourChildrenSummary />}
      {unlocked("documents") && <DocumentsSummary returnTo="review" />}

      {ready && (
        <>
          {/* Same size as the section headings above it. It is a peer of theirs in
              the outline, so it would be odd for it to be the loudest thing on the
              page after the h1 just because it is the last one. */}
          <GoabText tag="h2" size="heading-m" mt="2xl" mb="s">
            Now send your application
          </GoabText>
          {/*
            The declaration, and there is no tick box under it.

            A separate "I agree" checkbox asks a second question to get the same
            answer the button already gets, and there is no evidence ticking it
            carries more weight than pressing a button that says what pressing it
            means. So the agreement is in the button's own words. (Adam Silver, the
            child funeral fund service: "it's not clear that clicking a checkbox
            carries more legal weight than just pressing a button" — they replaced
            "Submit claim" with "Agree and submit claim".)

            THE WORDING BELOW IS A PLACEHOLDER. What a person is agreeing to is a
            question for your program and the people who advise it, not something to
            inherit from a template.
          */}
          <GoabText mt="none" mb="xl">
            By submitting this application you confirm that the information you have
            given is true and complete. [Replace this with your program's declaration.]
          </GoabText>
          <GoabButton type="primary" onClick={handleSubmit}>
            Agree and submit
          </GoabButton>
        </>
      )}
    </div>
  );
}
