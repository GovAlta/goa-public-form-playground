import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PublicFormLayout } from "./public-form-layout";
import { FormSet } from "./form-set";
import { useForm } from "../store/form-store";
import type { SectionId } from "../lib/form-state";

/**
 * A task's own check-answers page: the page every task ends on.
 *
 * TWO TIERS, DIFFERENT JOBS. This is the check over one task, and passing through it
 * is what completes that task — answering the last question brings you here rather
 * than returning you to the task list. /review is the check over the WHOLE
 * application, and passing through that is what sends it. A person meets one of these
 * once per task and that one once.
 *
 * It is a shell rather than four pages because the only things that differ are which
 * task it finishes and which summary it shows. Everything else — the heading, where
 * Back goes, what the button says, what pressing it does — is the same by design: a
 * person meets this page four times, and meeting a slightly different version each
 * time is how a form starts feeling improvised.
 *
 * NOT EVERY TASK NEEDS ONE. A task that asks a single question would be showing a
 * person one answer they are still looking at, which is ceremony. That is a per-task
 * decision rather than a rule derived from how many questions there are — see
 * `hasCheckPage` in lib/sections.ts.
 *
 * Reachable with the answers incomplete, by typing the URL, and that is deliberately
 * harmless rather than guarded. The rows show "Not answered", Continue records the
 * confirmation, and the task list still reads In progress, because confirming is
 * necessary and never sufficient (see FormState.confirmed). The same page then sends
 * the person to the first thing they have not answered when they click the row.
 */

type TaskReviewProps = {
  /** Which task this page finishes. */
  section: SectionId;
  /** The task's summary, rendered with returnTo="task" so Change links come back here. */
  children: ReactNode;
};

export function TaskReview({ section, children }: TaskReviewProps) {
  const navigate = useNavigate();
  const { dispatch } = useForm();

  /*
   * "Confirm and continue", not "Save and continue".
   *
   * A button is a contract: say what pressing it does. Nothing is saved here — the
   * answers were saved page by page on the way in — and something else is: this is
   * the person saying they have looked. Reusing the question pages' label would make
   * the one press that changes the task's status read as the most ordinary press in
   * the form.
   */
  const handleContinue = () => {
    dispatch({ type: "confirm-section", id: section });
    navigate("/");
  };

  return (
    // Back to the task list, the same as the first question of any section. It is the
    // one destination that is right from both ways in: walking forward off the last
    // question, and clicking a finished task on the list to look it over.
    <PublicFormLayout back="/" backLabel="Back">
      <FormSet
        heading="Check your answers"
        continueLabel="Confirm and continue"
        onContinue={handleContinue}
      >
        {children}
      </FormSet>
    </PublicFormLayout>
  );
}
