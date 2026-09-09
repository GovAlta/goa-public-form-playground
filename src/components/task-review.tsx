import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PublicFormLayout } from "./public-form-layout";
import { FormSet } from "./form-set";
import { useForm } from "../store/form-store";
import type { SectionId } from "../lib/form-state";

/**
 * A task's own check-answers page, where every task ends; passing through it is what
 * completes the task. /review is the check over the whole application. One shell for
 * every task so the page is the same each time; opting out is `hasCheckPage` in
 * lib/sections.ts.
 *
 * Reachable with answers incomplete by typing the URL, and harmless: rows show
 * "Not answered" and the task stays In progress, because confirming is necessary and
 * never sufficient (see FormState.confirmed).
 */

type TaskReviewProps = {
  section: SectionId;
  children: ReactNode;
};

export function TaskReview({ section, children }: TaskReviewProps) {
  const navigate = useNavigate();
  const { dispatch } = useForm();

  // "Confirm and continue", not "Save and continue": nothing is saved here; the person
  // is saying they have looked.
  const handleContinue = () => {
    dispatch({ type: "confirm-section", id: section });
    navigate("/");
  };

  return (
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
