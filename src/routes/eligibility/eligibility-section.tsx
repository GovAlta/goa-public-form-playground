import { useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  GoabCallout,
  GoabFormItem,
  GoabInput,
  GoabRadioGroup,
  GoabRadioItem,
} from "@abgov/react-components";
import { PublicFormLayout } from "../../components/public-form-layout";
import { TaskReview } from "../../components/task-review";
import { EligibilitySummary } from "../review/summaries";
import { FormSet } from "../../components/form-set";
import { useFormValidation } from "../../components/use-form-validation";
import { required } from "../../lib/validation";
import {
  firstUnansweredStep,
  STEPS,
  STEP_IDS,
  pruneUnreachable,
  remainingQuestions,
  resolveNext,
  type StepId,
} from "../../lib/eligibility";
import type { EligibilityAnswers } from "../../lib/form-state";
import {
  RETURN_DESTINATIONS,
  RETURN_LABELS,
  readReturnTo,
  withReturnTo,
  type ReturnTo,
} from "../../lib/return-to";
import { useForm } from "../../store/form-store";

/**
 * The screener: a section of several question pages that branch.
 *
 * Each question is a real route, so the browser back button works and a person can
 * be sent a link to where they left off. Where each answer leads is decided by the
 * graph in lib/eligibility.ts rather than by conditionals here, which is what lets
 * the same pages serve both a first run through and a change made later from the
 * review page.
 *
 * Where a person came from is carried in the URL rather than in router state,
 * because router state does not survive a refresh. Someone who reloads mid-change
 * would otherwise be silently dropped back into a normal run and sent to the task
 * list instead of back to the page they were checking. See lib/return-to.ts.
 */

const SECTION_ROOT = "/eligibility";

/** This task's own check-answers page: where the screener finishes. */
export const ELIGIBILITY_CHECK_PATH = `${SECTION_ROOT}/check`;

/**
 * The two pages a question here can be reached from, and where each one is.
 *
 * The names are resolved against these paths rather than carried in the URL, so a
 * renamed route cannot leave a stale destination behind and a hand-typed URL cannot
 * name a page this section does not have.
 */
const RETURN_PATHS = {
  review: "/review",
  task: ELIGIBILITY_CHECK_PATH,
} as const;

const SUPPORTED = ["review", "task"] as const;

const stepPath = (step: StepId, returnTo: ReturnTo | null): string =>
  withReturnTo(`${SECTION_ROOT}/${step}`, returnTo);

/**
 * Remount the question when the step changes.
 *
 * React Router reuses the same component instance when only a route parameter
 * changes, so useState is not re-initialised and the previous question's answer
 * would carry into the next one, pre-filling a question the person has not seen.
 * Keying by step forces a fresh mount, which re-seeds the draft from the store.
 */
function KeyedQuestionPage() {
  const { step } = useParams<{ step: string }>();
  return <QuestionPage key={step} step={step} />;
}

function QuestionPage({ step }: { step?: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useForm();

  const returnTo = readReturnTo(params, SUPPORTED);
  const stepId = STEP_IDS.includes(step as StepId) ? (step as StepId) : null;

  // A hand-typed or stale URL should not render a broken page.
  const [draft, setDraft] = useState<string>(
    stepId ? ((state.eligibility[stepId] as string | undefined) ?? "") : "",
  );

  const config = stepId ? STEPS[stepId] : null;
  const { errors, submit, revalidate } = useFormValidation(
    stepId && config ? { [stepId]: required(config.requiredError) } : {},
  );

  if (!stepId || !config) return <Navigate to={SECTION_ROOT} replace />;

  const handleChange = (value: string) => {
    setDraft(value);
    revalidate({ [stepId]: value });
  };

  const handleContinue = () => {
    submit({ [stepId]: draft }, () => {
      const answers = pruneUnreachable({
        ...state.eligibility,
        [stepId]: draft,
      } as EligibilityAnswers);

      dispatch({ type: "save-eligibility", answers });

      const next = resolveNext(stepId, answers);
      if ("question" in next) {
        navigate(stepPath(next.question, returnTo));
      } else if (next.outcome === "ineligible") {
        // The screener's OTHER terminal, and it completes the task just as its check
        // page does. Being told you cannot apply is a finished screener: there is
        // nothing left to answer, and the task list would otherwise hold this at
        // "In progress" forever with no page in the flow that could ever clear it.
        dispatch({ type: "confirm-section", id: "eligibility" });
        navigate("/not-eligible");
      } else {
        // The screener is finished. Back to whichever page sent them here, and when
        // nothing did, on to this task's own check page: answering the last question
        // is what brings you to the end of the task, and the end of the task is where
        // you look at what you said.
        navigate(returnTo ? RETURN_PATHS[returnTo] : ELIGIBILITY_CHECK_PATH);
      }
    });
  };

  // How many questions this answer has newly opened up. Shown only during a change,
  // where it is genuinely surprising to be asked more after clicking one Change link.
  const opened = returnTo
    ? remainingQuestions(stepId, { ...state.eligibility, [stepId]: draft } as EligibilityAnswers)
    : 0;

  const back = returnTo
    ? RETURN_PATHS[returnTo]
    : config.previous
      ? stepPath(config.previous, null)
      : "/";

  const fieldError = errors.find((e) => e.fieldId === stepId)?.text;

  return (
    <PublicFormLayout back={back} backLabel={returnTo ? RETURN_LABELS[returnTo] : "Back"}>
      {opened > 1 && (
        <GoabCallout type="information" mb="l">
          Your answer means there {opened === 2 ? "is 1 more question" : `are ${opened - 1} more questions`} to answer
          before you go back to {RETURN_DESTINATIONS[returnTo!]}.
        </GoabCallout>
      )}

      <FormSet
        heading={config.heading}
        continueLabel="Continue"
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          The error has to be set twice, and it is not a mistake. The form item takes
          the message, as a string; the control takes a boolean that turns it red.
          Setting only the form item gives you the words with no red field, which
          reads as a page-level complaint rather than a field-level one.

          One question on the page, so the question is the h1 and the field carries no
          visible label of its own — a label under the heading would ask the same thing
          twice. The control's ariaLabel carries the question for anyone who cannot see
          the heading, and it is the only thing that does: GoabFormItem's label has no
          `for` and does not wrap the control, so it names nothing.
        */}
        <GoabFormItem
          id={stepId}
          maxWidth="320px"
          error={fieldError}
          type={config.field === "yesno" ? "radio-group" : "text-input"}
        >
          {config.field === "yesno" ? (
            <GoabRadioGroup
              name={stepId}
              ariaLabel={config.heading}
              value={draft}
              error={Boolean(fieldError)}
              onChange={(detail) => handleChange(String(detail.value))}
            >
              <GoabRadioItem value="yes" label="Yes" />
              <GoabRadioItem value="no" label="No" />
            </GoabRadioGroup>
          ) : (
            <GoabInput
              name={stepId}
              ariaLabel={config.heading}
              value={draft}
              width="100%"
              error={Boolean(fieldError)}
              onChange={(detail) => handleChange(String(detail.value))}
            />
          )}
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

/**
 * The task's check-answers page, and where the task actually finishes.
 *
 * The summary is the same component the whole-application review renders, told to
 * send its Change links back HERE rather than to /review — which is the reason the
 * return target is a named origin and not a constant. See lib/return-to.ts.
 */
function CheckPage() {
  return (
    <TaskReview section="eligibility">
      <EligibilitySummary returnTo="task" />
    </TaskReview>
  );
}

/**
 * Send someone entering the section to the first question still unanswered on their
 * own path, or to this task's check page when the screener needs nothing.
 *
 * Both halves matter. Walking the branches is what stops someone being asked a
 * question their answers ruled out. Landing a finished screener on its check page is
 * what stops it dumping them into its last question with no idea how they got there:
 * re-entering a section that needs nothing means looking it over, and the page that
 * shows every answer at once is where looking starts.
 *
 * The rule lives in lib/eligibility.ts with the other three walkers, not here. A page
 * is the wrong place to keep a fact about the shape of the service, which is exactly
 * how the version this replaces came to scan the questions in declaration order and
 * ignore the branch graph sitting one import away.
 */
function SectionEntry() {
  const { state } = useForm();
  const next = firstUnansweredStep(state.eligibility);
  return <Navigate to={next ? stepPath(next, null) : ELIGIBILITY_CHECK_PATH} replace />;
}

export function EligibilitySection() {
  return (
    <Routes>
      <Route index element={<SectionEntry />} />
      {/* Before the question route in the file, though React Router ranks a static
          segment above a dynamic one either way. A step id of "check" would collide
          with this — see the guard in lib/sections.test.ts. */}
      <Route path="check" element={<CheckPage />} />
      <Route path=":step" element={<KeyedQuestionPage />} />
      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
