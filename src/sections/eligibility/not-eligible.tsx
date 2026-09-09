import { useNavigate } from "react-router-dom";
import { GoabButton, GoabButtonGroup, GoabText } from "@abgov/react-components";
import { ResultsPage, ResultContactSection } from "../../components/results-page";
import { useForm } from "../../store/form-store";
import { screenerOutcome } from "./rules";

/**
 * The screener ruled them out. Says which answer decided it, and offers a way back,
 * because people mistype and a dead end with no exit loses someone who did qualify.
 */
export function NotEligible() {
  const navigate = useNavigate();
  const { state } = useForm();
  const answers = state.eligibility;

  // Name the specific gate rather than saying "you are not eligible" and stopping.
  const reason =
    answers.age === "no"
      ? "This support is only available to people aged 18 or older."
      : answers.residency === "no"
        ? "This support is only available to people living in Alberta."
        : "Based on your answers, you cannot apply for this support.";

  // Someone who arrives here without having failed the screener took a wrong turn.
  if (screenerOutcome(answers) !== "ineligible") {
    return (
      <ResultsPage
        heading="Nothing to see here yet"
        status="important"
        statusHeading="You have not finished the eligibility questions"
        actions={
          <GoabButtonGroup alignment="start">
            <GoabButton type="primary" onClick={() => navigate("/eligibility")}>
              Go to the eligibility questions
            </GoabButton>
          </GoabButtonGroup>
        }
      />
    );
  }

  return (
    <ResultsPage
      heading="You cannot apply for this support"
      status="important"
      statusHeading="You are not eligible"
      statusBody={reason}
      actions={
        <GoabButtonGroup alignment="start">
          <GoabButton type="secondary" onClick={() => navigate("/eligibility")}>
            Change your answers
          </GoabButton>
          <GoabButton type="tertiary" onClick={() => navigate("/")}>
            Return to the task list
          </GoabButton>
        </GoabButtonGroup>
      }
    >
      <GoabText tag="h2" mt="xl" mb="s">
        Other support you may be able to get
      </GoabText>
      <GoabText mt="none" mb="none">
        [Link to other programs a person in this situation might qualify for. A dead end
        with no onward route is a poor outcome even when the answer is no.]
      </GoabText>

      <ResultContactSection />
    </ResultsPage>
  );
}
