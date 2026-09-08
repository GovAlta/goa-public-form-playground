import { Navigate, useNavigate } from "react-router-dom";
import { GoabText, GoabButton, GoabLink } from "@abgov/react-components";
import { ResultsPage, ResultContactSection } from "../../components/results-page";
import { useForm } from "../../store/form-store";
import { startNewApplication } from "../../store/form-store";

/**
 * The end of the road: the application has been sent.
 *
 * The reference number is the reason this page exists. Everything else here is
 * reassurance, and reassurance is worth having, but the reference is the only thing
 * on the page the person cannot get anywhere else — so it leads, inside the status
 * callout, rather than sitting in a paragraph they have to find.
 *
 * It survives a refresh because it is saved with the rest of the application rather
 * than held in memory by this page. Someone told to keep a number will refresh,
 * bookmark, or come back to it, and a confirmation that evaporates on reload is a
 * service losing the receipt it just handed over.
 */
export function ConfirmationPage() {
  const { state, dispatch } = useForm();
  const navigate = useNavigate();

  // Nobody reaches a confirmation for an application they have not submitted. Someone
  // who bookmarked this or typed the URL goes where the work actually is.
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
        // A real service ends here, usually with a link back to Alberta.ca. This
        // button exists because a template that can only be completed once is a
        // template nobody can demonstrate twice: the application stays submitted in
        // the browser until something clears it. Replace it rather than inherit it.
        <GoabButton type="secondary" onClick={startAgain}>
          Start a new application
        </GoabButton>
      }
    >
      <GoabText tag="h2" mt="xl" mb="s">
        What happens next
      </GoabText>
      <GoabText mt="none" mb="s">
        We have sent your application for review. You do not need to do anything else
        for now.
      </GoabText>
      <GoabText mt="none" mb="none">
        We will contact you by phone if we need anything more from you. [Replace this
        with what your program actually does next, and how long it takes.]
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
