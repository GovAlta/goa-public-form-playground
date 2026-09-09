import { useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  GoabCallout,
  GoabFormItem,
  GoabInput,
  GoabRadioGroup,
  GoabRadioItem,
} from "@abgov/react-components";
import { PublicFormLayout } from "../../components/public-form-layout";
import { TaskReview } from "../../components/task-review";
import { EligibilitySummary } from "./summary";
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
} from "./rules";
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
 * The screener: question pages that branch. Each question is its own route, so Back
 * and links work; where an answer leads is the graph in rules.ts, which is
 * what lets the same pages serve a first run and a change made later from review.
 */

const SECTION_ROOT = "/eligibility";

export const ELIGIBILITY_CHECK_PATH = `${SECTION_ROOT}/check`;

const RETURN_PATHS = {
  review: "/review",
  task: ELIGIBILITY_CHECK_PATH,
} as const;

const SUPPORTED = ["review", "task"] as const;

const stepPath = (step: StepId, returnTo: ReturnTo | null): string =>
  withReturnTo(`${SECTION_ROOT}/${step}`, returnTo);

/**
 * Keyed by step: React Router reuses the component instance when only a param changes,
 * and the previous answer carried into the next question until this forced a remount.
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
        // Ineligible is the screener's other terminal and completes the task too;
        // otherwise the task list would hold it at "In progress" forever.
        dispatch({ type: "confirm-section", id: "eligibility" });
        navigate("/not-eligible");
      } else {
        navigate(returnTo ? RETURN_PATHS[returnTo] : ELIGIBILITY_CHECK_PATH);
      }
    });
  };

  // Questions this answer newly opened; shown only during a change, where more surprise.
  const opened = returnTo
    ? remainingQuestions(stepId, {
        ...state.eligibility,
        [stepId]: draft,
      } as EligibilityAnswers)
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
          Your answer means there{" "}
          {opened === 2 ? "is 1 more question" : `are ${opened - 1} more questions`} to
          answer before you go back to {RETURN_DESTINATIONS[returnTo!]}.
        </GoabCallout>
      )}

      <FormSet
        heading={config.heading}
        continueLabel="Continue"
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          The error is set twice on purpose: the form item takes the message, the control
          takes the boolean that turns it red. One question, so it is the h1 with no
          visible label, and the control's ariaLabel carries it for screen readers.
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

function CheckPage() {
  return (
    <TaskReview section="eligibility">
      <EligibilitySummary returnTo="task" />
    </TaskReview>
  );
}

function SectionEntry() {
  const { state } = useForm();
  const next = firstUnansweredStep(state.eligibility);
  return <Navigate to={next ? stepPath(next, null) : ELIGIBILITY_CHECK_PATH} replace />;
}

export function EligibilitySection() {
  return (
    <Routes>
      <Route index element={<SectionEntry />} />
      {/* A step id of "check" would collide with this route. */}
      <Route path="check" element={<CheckPage />} />
      <Route path=":step" element={<KeyedQuestionPage />} />
      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
