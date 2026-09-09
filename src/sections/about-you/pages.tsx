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
import { AboutYouSummary } from "./summary";
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
} from "./rules";
import type { AboutYouAnswers } from "../../lib/form-state";
import {
  RETURN_LABELS,
  readReturnTo,
  withReturnTo,
  type ReturnTo,
} from "../../lib/return-to";
import { useForm } from "../../store/form-store";

/**
 * About you: name, date of birth, contact, address. Four hand-written pages rather than
 * one page driven from config, unlike the screener: these are four different controls,
 * and a renderer for all of them would be more machinery than the pages it replaced.
 */

const SECTION_ROOT = "/about-you";

export const ABOUT_YOU_CHECK_PATH = `${SECTION_ROOT}/check`;

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
 * A draft seeded from the store, validated on submit. Answers reach the store only on a
 * valid submit, so a half-typed answer abandoned with Back is not saved as an answer.
 */
function useStep(step: AboutYouStepId) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const config = ABOUT_YOU_STEPS[step];

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

  const errorFor = (field: AboutYouField) =>
    errors.find((e) => e.fieldId === field)?.text;

  const handleContinue = () =>
    submit(draft as Record<string, unknown>, () => {
      dispatch({ type: "save-about-you", answers: draft });

      // Nothing here branches, so a change from a check page goes straight back.
      if (returnTo) {
        navigate(RETURN_PATHS[returnTo]);
        return;
      }

      // The last question leads to the task's check page, not the task list.
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
    continueLabel: returnTo ? "Save and return" : "Save and continue",
  };
}

function NamePage() {
  const {
    heading,
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back,
    backLabel,
    continueLabel,
  } = useStep("name");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          autoComplete tokens on every field about the applicant, here and on the three
          pages below: WCAG 2.2 AA 1.3.5, and without them Chrome guesses these name
          fields as payment fields.
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
  const {
    heading,
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back,
    backLabel,
    continueLabel,
  } = useStep("date-of-birth");

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      {/* One question: it is the h1, so the field carries no visible label of its own. */}
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem id="dateOfBirth" error={errorFor("dateOfBirth")}>
          {/*
            type="input", not the calendar: a birth date is recalled, not picked. No
            `max`, because clamping would hide the mistake instead of saying it. And
            GoabDatePicker takes no ariaLabel and names its inner fields nothing, so the
            h1 is the only place the question reaches a screen reader.
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
  const {
    heading,
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back,
    backLabel,
    continueLabel,
  } = useStep("contact");

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

        {/* The only optional field, so the only one marked: people assume everything is
            required unless told otherwise. */}
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
  const {
    heading,
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back,
    backLabel,
    continueLabel,
  } = useStep("address");

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

        <GoabFormItem
          label="Suite or unit number"
          id="suite"
          requirement="optional"
          mt="l"
        >
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

        {/* Province and postal code stack rather than share a row: the error summary
            jumps through fields in order. Each is sized to what it holds. */}
        <GoabFormItem
          label="Province or territory"
          id="province"
          error={errorFor("province")}
          mt="l"
        >
          <GoabDropdown
            name="province"
            ariaLabel="Province or territory"
            // No autoComplete: GoabDropdown accepts the prop and ignores it (a custom
            // combobox with autocomplete="off" inside its shadow root), so this field
            // cannot join the address autofill the others support.
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

        <GoabFormItem
          label="Postal code"
          id="postalCode"
          error={errorFor("postalCode")}
          mt="l"
        >
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

function CheckPage() {
  return (
    <TaskReview section="about-you">
      <AboutYouSummary returnTo="task" />
    </TaskReview>
  );
}

function SectionEntry() {
  const { state } = useForm();
  const next = firstIncompleteStep(state.aboutYou);
  return <Navigate to={next ? stepPath(next, null) : ABOUT_YOU_CHECK_PATH} replace />;
}

/** Typed over every step id, so adding a step fails the build until it has a page. A lookup, not a renderer. */
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

      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
