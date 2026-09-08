import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import {
  GoabDatePicker,
  GoabDropdown,
  GoabDropdownItem,
  GoabFormItem,
  GoabInput,
} from "@abgov/react-components";
import { PublicFormLayout } from "../../components/public-form-layout";
import { TaskReview } from "../../components/task-review";
import { AboutYouSummary } from "../review/summaries";
import { FormSet } from "../../components/form-set";
import { useFormValidation } from "../../components/use-form-validation";
import {
  ABOUT_YOU_STEPS,
  ABOUT_YOU_STEP_IDS,
  firstIncompleteStep,
  nextStep,
  previousStep,
  type AboutYouField,
  type AboutYouStepId,
} from "../../lib/about-you";
import type { AboutYouAnswers } from "../../lib/form-state";
import { RETURN_LABELS, readReturnTo, withReturnTo, type ReturnTo } from "../../lib/return-to";
import { useForm } from "../../store/form-store";

/**
 * About you: name, date of birth, contact, address.
 *
 * Four hand-written pages rather than one page driven from config, which is the
 * opposite of the screener next door. The screener's questions are all the same shape
 * — a yes/no or a text box — so one component renders all of them from data. These
 * four are genuinely different controls, and a registry that could render all of them
 * would be more machinery than the four pages it replaced, in the file a person
 * forking this template is most likely to edit.
 *
 * It buys a second thing for free. The screener needed an explicit `key` to force a
 * remount between questions, because React Router reuses one component instance when
 * only a route parameter changes, and the previous answer was carrying into the next
 * question. Four distinct components on four explicit routes cannot have that bug:
 * React unmounts one and mounts the other because they are different elements.
 */

const SECTION_ROOT = "/about-you";

/** This task's own check-answers page: where the section finishes. */
export const ABOUT_YOU_CHECK_PATH = `${SECTION_ROOT}/check`;

/** The two pages a question here can be reached from. See lib/return-to.ts. */
const RETURN_PATHS = {
  review: "/review",
  task: ABOUT_YOU_CHECK_PATH,
} as const;

const SUPPORTED = ["review", "task"] as const;

const stepPath = (step: AboutYouStepId, returnTo: ReturnTo | null) =>
  withReturnTo(`${SECTION_ROOT}/${step}`, returnTo);

const PROVINCES: ReadonlyArray<[string, string]> = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
];

/**
 * What all four pages share: a draft seeded from the store, validation on submit,
 * and where Continue goes.
 *
 * The draft is separate from the store on purpose. Answers reach the store only on a
 * valid submit, so a half-typed postal code someone abandons by pressing Back is not
 * saved as their answer, and the task list does not start calling the section
 * "in progress" because they looked at it.
 */
function useStep(step: AboutYouStepId) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const config = ABOUT_YOU_STEPS[step];

  // Carried in the URL rather than router state, so a refresh mid-change still
  // returns to the page being checked instead of silently rejoining the normal run.
  const returnTo = readReturnTo(params, SUPPORTED);

  const [draft, setDraft] = useState<AboutYouAnswers>(
    () =>
      Object.fromEntries(
        config.fields.map((field) => [field, state.aboutYou[field] ?? ""]),
      ) as AboutYouAnswers,
  );

  const { errors, submit, revalidate } = useFormValidation(config.schema);

  const set = (field: AboutYouField) => (value: string) =>
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      revalidate(next as Record<string, unknown>);
      return next;
    });

  const errorFor = (field: AboutYouField) => errors.find((e) => e.fieldId === field)?.text;

  const handleContinue = () =>
    submit(draft as Record<string, unknown>, () => {
      dispatch({ type: "save-about-you", answers: draft });

      // Nothing in this section branches, so a change made from a check page can
      // never open a question the person has not seen. They go straight back.
      if (returnTo) {
        navigate(RETURN_PATHS[returnTo]);
        return;
      }

      // Answering the last question is what brings you to the end of the task, and
      // the end of the task is its check page rather than the task list.
      const next = nextStep(step);
      navigate(next ? stepPath(next, null) : ABOUT_YOU_CHECK_PATH);
    });

  const previous = previousStep(step);

  return {
    heading: config.heading,
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back: returnTo ? RETURN_PATHS[returnTo] : previous ? stepPath(previous, null) : "/",
    backLabel: returnTo ? RETURN_LABELS[returnTo] : "Back",
    // A button is a contract: say what pressing it does. On the last page of the
    // section "continue" is the check page, which is still continuing.
    continueLabel: returnTo ? "Save and return" : "Save and continue",
  };
}

/* -------------------------------------------------------------------------- */

function NamePage() {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useStep("name");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          Every field about the applicant carries an autocomplete token, here and on
          the three pages below.

          This is a WCAG 2.2 AA requirement, not a nicety: 1.3.5 Identify Input
          Purpose asks that a field collecting information about the person be
          programmatically identifiable. It is also the difference between a browser
          filling an address in one gesture and a person typing it again.

          Left off, browsers do not give up — they guess from labels and names, and
          they guess badly. Chrome reads these name fields as payment fields, which
          is visible over plain HTTP as a warning about payment autofill on an
          insecure connection, and invisible over HTTPS while still being wrong. The
          warning is a symptom; the missing token is the fault.
        */}
        <GoabFormItem label="First name" id="firstName" error={errorFor("firstName")}>
          <GoabInput
            name="firstName"
            ariaLabel="First name"
            autoComplete="given-name"
            width="100%"
            value={draft.firstName ?? ""}
            error={Boolean(errorFor("firstName"))}
            onChange={(detail) => set("firstName")(String(detail.value))}
          />
        </GoabFormItem>

        <GoabFormItem label="Last name" id="lastName" error={errorFor("lastName")} mt="l">
          <GoabInput
            name="lastName"
            ariaLabel="Last name"
            autoComplete="family-name"
            width="100%"
            value={draft.lastName ?? ""}
            error={Boolean(errorFor("lastName"))}
            onChange={(detail) => set("lastName")(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

function DateOfBirthPage() {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useStep("date-of-birth");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      {/*
        One question, so the question is the h1 and the field carries no visible label
        of its own — a label under the heading would ask the same thing twice.
      */}
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem id="dateOfBirth" error={errorFor("dateOfBirth")}>
          {/*
            type="input" is a month dropdown with day and year text boxes, which is the
            right shape for a date a person already knows. The calendar variant is for
            dates someone is picking rather than recalling; reaching a birth date
            through it means clicking back through several hundred months.

            Deliberately no `max` to block future dates. Clamping the control would
            hide the mistake rather than prevent it, and the person would be left
            wondering why the year would not take. The rule says so in words instead.

            Unlike every other control here, this one cannot be given an accessible
            name: GoabDatePicker exposes no ariaLabel, and it names its own inner
            fields "month", "" and "" — the day and the year are announced as nothing.
            So the h1 above is the only place the question is stated to a screen reader
            user, and it is not attached to the field. That is a component gap, not
            something this page can close.
          */}
          <GoabDatePicker
            name="dateOfBirth"
            type="input"
            value={draft.dateOfBirth || undefined}
            error={Boolean(errorFor("dateOfBirth"))}
            onChange={(detail) => set("dateOfBirth")(detail.valueStr ?? "")}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

function ContactPage() {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useStep("contact");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem
          label="Phone number"
          id="phone"
          helpText="Include the area code"
          error={errorFor("phone")}
        >
          <GoabInput
            name="phone"
            type="tel"
            ariaLabel="Phone number"
            autoComplete="tel"
            width="320px"
            value={draft.phone ?? ""}
            error={Boolean(errorFor("phone"))}
            onChange={(detail) => set("phone")(String(detail.value))}
          />
        </GoabFormItem>

        {/*
          The only optional answer in the service, so it is the only field carrying the
          marker. Marking the optional ones rather than the required ones is the way
          round that matches what people already assume, which is that everything is
          required unless told otherwise.
        */}
        <GoabFormItem
          label="Email address"
          id="email"
          requirement="optional"
          error={errorFor("email")}
          mt="l"
        >
          <GoabInput
            name="email"
            type="email"
            ariaLabel="Email address"
            autoComplete="email"
            width="100%"
            value={draft.email ?? ""}
            error={Boolean(errorFor("email"))}
            onChange={(detail) => set("email")(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

function AddressPage() {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useStep("address");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem label="Street address" id="street" error={errorFor("street")}>
          <GoabInput
            name="street"
            ariaLabel="Street address"
            autoComplete="address-line1"
            width="100%"
            value={draft.street ?? ""}
            error={Boolean(errorFor("street"))}
            onChange={(detail) => set("street")(String(detail.value))}
          />
        </GoabFormItem>

        <GoabFormItem label="Suite or unit number" id="suite" requirement="optional" mt="l">
          <GoabInput
            name="suite"
            ariaLabel="Suite or unit number"
            autoComplete="address-line2"
            width="160px"
            value={draft.suite ?? ""}
            onChange={(detail) => set("suite")(String(detail.value))}
          />
        </GoabFormItem>

        <GoabFormItem label="City or town" id="city" error={errorFor("city")} mt="l">
          <GoabInput
            name="city"
            ariaLabel="City or town"
            autoComplete="address-level2"
            width="100%"
            value={draft.city ?? ""}
            error={Boolean(errorFor("city"))}
            onChange={(detail) => set("city")(String(detail.value))}
          />
        </GoabFormItem>

        {/*
          Province and postal code are stacked rather than sat side by side. Two
          reasons, and the second is the one that decides it: a form is filled fastest
          down a single column, and the error summary jumps through fields in order —
          "top to bottom" stops meaning anything the moment two fields share a row.

          Each is sized to what it holds rather than run full width, so the width is
          itself a hint about the expected answer.
        */}
        <GoabFormItem
          label="Province or territory"
          id="province"
          error={errorFor("province")}
          mt="l"
        >
          <GoabDropdown
            name="province"
            ariaLabel="Province or territory"
            // No autoComplete here, and its absence is measured rather than an
            // oversight. GoabDropdown accepts the prop and does nothing with it: it
            // renders a custom combobox rather than a native select, and hardcodes
            // autocomplete="off" on the input inside its shadow root. Passing
            // "address-level1" changes nothing, so it is not passed — a template is
            // read as an example, and a prop that looks load-bearing and is inert
            // teaches every fork to write more of them.
            //
            // The consequence is real: this one field cannot join the address
            // autofill the four around it now support, and cannot satisfy WCAG 1.3.5.
            // Raised as a draft issue against the component.
            width="320px"
            value={draft.province ?? ""}
            error={Boolean(errorFor("province"))}
            onChange={(detail) => set("province")(detail.value ?? "")}
          >
            {PROVINCES.map(([value, label]) => (
              <GoabDropdownItem key={value} value={value} label={label} />
            ))}
          </GoabDropdown>
        </GoabFormItem>

        <GoabFormItem label="Postal code" id="postalCode" error={errorFor("postalCode")} mt="l">
          <GoabInput
            name="postalCode"
            ariaLabel="Postal code"
            autoComplete="postal-code"
            width="160px"
            value={draft.postalCode ?? ""}
            error={Boolean(errorFor("postalCode"))}
            onChange={(detail) => set("postalCode")(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The task's check-answers page, and where the task actually finishes.
 *
 * The summary is the same component the whole-application review renders, told to
 * send its Change links back HERE rather than to /review — which is the reason the
 * return target is a named origin and not a constant. See lib/return-to.ts.
 */
function CheckPage() {
  return (
    <TaskReview section="about-you">
      <AboutYouSummary returnTo="task" />
    </TaskReview>
  );
}

/**
 * Send someone entering the section to the first page they have not finished, or to
 * this task's check page when there is nothing left — re-entering a finished section
 * means looking it over, and the page showing every answer at once is where looking
 * starts.
 */
function SectionEntry() {
  const { state } = useForm();
  const next = firstIncompleteStep(state.aboutYou);
  return <Navigate to={next ? stepPath(next, null) : ABOUT_YOU_CHECK_PATH} replace />;
}

/**
 * Which component answers for each step.
 *
 * Typed as a record over every step id rather than written out as four <Route>
 * elements, and that is the only reason it exists: adding a step to AboutYouStepId
 * now fails the build here until it has a page, instead of silently redirecting to
 * the section entry at runtime and looking like a routing bug.
 *
 * The pages themselves are still hand-written. This is a lookup, not a renderer.
 */
const PAGES: Record<AboutYouStepId, () => ReactElement> = {
  name: NamePage,
  "date-of-birth": DateOfBirthPage,
  contact: ContactPage,
  address: AddressPage,
};

export function AboutYouSection() {
  return (
    <Routes>
      <Route index element={<SectionEntry />} />
      <Route path="check" element={<CheckPage />} />

      {ABOUT_YOU_STEP_IDS.map((id) => {
        const Page = PAGES[id];
        return <Route key={id} path={id} element={<Page />} />;
      })}

      {/* A hand-typed or stale URL lands on the section entry, not a broken page. */}
      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
