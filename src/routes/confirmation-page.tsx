import { Navigate, useNavigate } from "react-router-dom";
import { GoabText, GoabButton, GoabLink } from "@abgov/react-components";
import { ResultsPage, ResultContactSection } from "../components/results-page";
import { useForm } from "../store/form-store";
import { startNewApplication } from "../store/form-store";

/**
 * The application has been sent. The reference number leads, inside the status callout,
 * because it is the one thing here the person cannot get anywhere else; it survives a
 * refresh because it is saved with the application rather than held by this page.
 */
export function ConfirmationPage() {
  const { state, dispatch } = useForm();
  const navigate = useNavigate();

  // No confirmation for an unsubmitted application: a bookmark or typed URL goes to the work.
  if (!state.submittedAt || !state.reference) {
    return <Navigate to="/" replace />;
  }

  async function startAgain() {
    await startNewApplication(dispatch);
    navigate("/");
  }

  return (
    <ResultsPage
      heading="Application submitted"
      status="success"
      statusHeading={`Your reference number is ${state.reference}`}
      statusBody="Keep this number. You will need it if you contact us about this application."
      actions={
        // A real service ends here, usually with a link back to Alberta.ca. This button
        // exists so the demo can be run more than once; replace it rather than inherit it.
        <GoabButton type="secondary" onClick={startAgain}>
          Start a new application
        </GoabButton>
      }
    >
      <GoabText tag="h2" mt="xl" mb="s">
        What happens next
      </GoabText>
      <GoabText mt="none" mb="s">
        We have sent your application for review. You do not need to do anything else for
        now.
      </GoabText>
      <GoabText mt="none" mb="none">
        We will contact you by phone if we need anything more from you. [Replace this with
        what your program actually does next, and how long it takes.]
      </GoabText>

      <GoabText tag="h2" mt="xl" mb="s">
        What did you think of this service?
      </GoabText>
      <GoabText mt="none" mb="none">
        <GoabLink mt="none" mb="none">
          <a href="#">Give feedback</a>
        </GoabLink>{" "}
        so it can be improved. It takes 2 minutes.
      </GoabText>

      <ResultContactSection />
    </ResultsPage>
  );
}
