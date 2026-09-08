import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  GoabDatePicker,
  GoabFormItem,
  GoabInput,
  GoabRadioGroup,
  GoabRadioItem,
} from "@abgov/react-components";
import { PublicFormLayout } from "../../components/public-form-layout";
import { FormSet } from "../../components/form-set";
import { ItemList } from "../../components/item-list";
import { FormSummary, SummarySection, SummaryItem } from "../../components/form-summary";
import { useFormValidation } from "../../components/use-form-validation";
import { formatDate, formatYesNo } from "../../lib/format";
import type { Schema } from "../../lib/validation";
import {
  CHILD_STEPS,
  CHILD_STEP_IDS,
  FIRST_CHILD_STEP,
  childLabel,
  emptyChild,
  firstIncompleteChildStep,
  isChildComplete,
  previousChildStep,
  pruneChild,
  reachableChildSteps,
  resolveNextChildStep,
  type ChildField,
  type ChildStepId,
} from "../../lib/your-children";
import type { ChildRecord } from "../../lib/form-state";
import { RETURN_LABELS, readReturnTo, withReturnTo, type ReturnTo } from "../../lib/return-to";
import { newId, useForm } from "../../store/form-store";

/**
 * Your children: a repeating group, collected one child at a time across pages.
 *
 * The list is the section's home. Adding a child walks the same kind of question
 * pages as the rest of the form, branching on whether the child lives with the
 * applicant, and returns here — so the sub-flow is the form pattern looped rather
 * than a different mode with its own rules. lib/your-children.ts holds the graph and
 * the walkers; this file is the pages and the routing.
 *
 * Answers are saved page by page, as they are everywhere else in this template. That
 * has one visible consequence worth understanding before you copy it: a child added
 * and abandoned halfway is a real row in the list, shown as unfinished. The list will
 * not let the section be completed while one exists, and Remove is on the row. The
 * alternative — holding the whole child in memory until a final confirm — would mean
 * a browser refresh mid-add silently discarding everything, which is not a promise
 * this service can make while its task list says progress is saved automatically.
 */

const SECTION_ROOT = "/your-children";

/**
 * The one page a question in this sub-flow can be reached from.
 *
 * Only "child" — the check page for the child being edited. This section has no
 * task-level check page of its own, because the list IS that page, and a question
 * here is never reached from the whole-application review: its Change link goes to
 * the list rather than into a child. See lib/return-to.ts.
 */
const SUPPORTED = ["child"] as const;

const stepPath = (childId: string, step: ChildStepId, returnTo: ReturnTo | null) =>
  withReturnTo(`${SECTION_ROOT}/${childId}/${step}`, returnTo);

const checkPath = (childId: string) => `${SECTION_ROOT}/${childId}/check`;

/**
 * The short names each answer goes by once it is being shown back rather than asked.
 *
 * Typed over every field, so adding one to ChildRecord fails the build here until it
 * has a name to be listed under. The questions themselves are too long for the left
 * column of a summary row: "What is the child's date of birth?" asked is "Date of
 * birth" reported.
 */
const FIELD_LABELS: Record<ChildField, string> = {
  firstName: "First name",
  lastName: "Last name",
  dateOfBirth: "Date of birth",
  livesWithYou: "Lives with you",
  // Not "Lives with", which sat directly under "Lives with you" and read as the same
  // question asked twice.
  livingArrangement: "Who they live with",
};

/**
 * What each Change link says, per page.
 *
 * Four links all saying "Change" are unambiguous on screen, where each one sits
 * beside the answer it changes, and useless to anyone listing the links on the page
 * or hearing them one at a time. Naming the target is what makes each link make sense
 * out of context.
 */
const CHANGE_LABELS: Record<ChildStepId, string> = {
  name: "Change name",
  "date-of-birth": "Change date of birth",
  "lives-with-you": "Change whether they live with you",
  "living-arrangement": "Change who they live with",
};

const displayValue = (field: ChildField, child: ChildRecord): string => {
  if (field === "dateOfBirth") return formatDate(child.dateOfBirth);
  if (field === "livesWithYou") return formatYesNo(child.livesWithYou);
  return child[field] ?? "";
};

/* -------------------------------------------------------------------------- */
/* What every question page in the sub-flow shares                             */
/* -------------------------------------------------------------------------- */

/**
 * A draft seeded from the stored child, validation on submit, and where Continue
 * goes next.
 *
 * The draft is separate from the store for the same reason it is in About you: a
 * half-typed answer someone abandons by pressing Back should not be saved as their
 * answer. What is different here is that the record itself already exists, so Back
 * leaves an unfinished child rather than nothing at all.
 */
function useChildStep(step: ChildStepId, child: ChildRecord) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dispatch } = useForm();
  const config = CHILD_STEPS[step];

  // Carried in the URL rather than router state, so a refresh mid-change still
  // returns to the check page instead of silently rejoining a normal run.
  const returnTo = readReturnTo(params, SUPPORTED);

  const [draft, setDraft] = useState<ChildRecord>(child);
  const { errors, submit, revalidate } = useFormValidation(config.schema);

  const set = (field: ChildField) => (value: string) =>
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      revalidate(next as unknown as Record<string, unknown>);
      return next;
    });

  const errorFor = (field: ChildField) => errors.find((e) => e.fieldId === field)?.text;

  const handleContinue = () =>
    submit(draft as unknown as Record<string, unknown>, () => {
      // Prune before saving, so an answer the changed path no longer reaches does not
      // sit in the store waiting to reappear if the person flips back.
      const saved = pruneChild(draft);
      dispatch({ type: "update-child", id: saved.id, child: saved });

      const next = resolveNextChildStep(step, saved);
      if ("question" in next) {
        navigate(stepPath(saved.id, next.question, returnTo));
        return;
      }
      navigate(returnTo ? checkPath(saved.id) : SECTION_ROOT);
    });

  const previous = previousChildStep(step, draft);

  return {
    heading: config.heading(draft),
    draft,
    set,
    errors,
    errorFor,
    handleContinue,
    back: returnTo
      ? checkPath(draft.id)
      : previous
        ? stepPath(draft.id, previous, null)
        : SECTION_ROOT,
    backLabel: returnTo ? RETURN_LABELS[returnTo] : "Back",
    continueLabel: returnTo ? "Save and return" : "Save and continue",
  };
}

/* -------------------------------------------------------------------------- */
/* The four questions                                                          */
/* -------------------------------------------------------------------------- */

function NamePage({ child }: { child: ChildRecord }) {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useChildStep("name", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem label="First name" id="firstName" error={errorFor("firstName")}>
          <GoabInput
            name="firstName"
            ariaLabel="First name"
            // "off", not a name token, and the difference matters. WCAG 1.3.5 asks for
            // the purpose of fields collecting information about THE USER; a child is a
            // different person, so given-name here would invite the browser to fill the
            // applicant's own name into their child's. A browser told nothing guesses,
            // so it has to be told to stop rather than left silent.
            autoComplete="off"
            width="100%"
            value={draft.firstName}
            error={Boolean(errorFor("firstName"))}
            onChange={(detail) => set("firstName")(String(detail.value))}
          />
        </GoabFormItem>

        <GoabFormItem label="Last name" id="lastName" error={errorFor("lastName")} mt="l">
          <GoabInput
            name="lastName"
            ariaLabel="Last name"
            autoComplete="off"
            width="100%"
            value={draft.lastName}
            error={Boolean(errorFor("lastName"))}
            onChange={(detail) => set("lastName")(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

function DateOfBirthPage({ child }: { child: ChildRecord }) {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useChildStep("date-of-birth", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          The same control, and the same gap, as the applicant's own date of birth:
          GoabDatePicker exposes no ariaLabel and names its inner day and year fields
          nothing at all, so the h1 above is the only place this question is stated to
          a screen reader user. That is a component gap, not something a page can close.
        */}
        <GoabFormItem id="dateOfBirth" error={errorFor("dateOfBirth")}>
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

function LivesWithYouPage({ child }: { child: ChildRecord }) {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useChildStep("lives-with-you", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/*
          One question on the page, so the heading asks it and the group carries no
          visible label. The radio group's ariaLabel repeats the heading because
          nothing else names it: GoabFormItem's label has no `for` and does not wrap
          its control, and a radio group here has no role="radiogroup" of its own.
        */}
        <GoabFormItem id="livesWithYou" type="radio-group" error={errorFor("livesWithYou")}>
          <GoabRadioGroup
            name="livesWithYou"
            ariaLabel={heading}
            value={draft.livesWithYou ?? ""}
            error={Boolean(errorFor("livesWithYou"))}
            onChange={(detail) => set("livesWithYou")(String(detail.value))}
          >
            <GoabRadioItem value="yes" label="Yes" />
            <GoabRadioItem value="no" label="No" />
          </GoabRadioGroup>
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

function LivingArrangementPage({ child }: { child: ChildRecord }) {
  const { heading, draft, set, errors, errorFor, handleContinue, back, backLabel, continueLabel } =
    useChildStep("living-arrangement", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        <GoabFormItem
          id="livingArrangement"
          helpText="For example, their other parent, or a guardian."
          error={errorFor("livingArrangement")}
        >
          <GoabInput
            name="livingArrangement"
            ariaLabel={heading}
            width="100%"
            value={draft.livingArrangement ?? ""}
            error={Boolean(errorFor("livingArrangement"))}
            onChange={(detail) => set("livingArrangement")(String(detail.value))}
          />
        </GoabFormItem>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* One child's answers, shown back                                             */
/* -------------------------------------------------------------------------- */

/**
 * The check page: the sub-flow's own small review, reached by changing a child from
 * the list rather than by finishing one.
 *
 * Grouped by page rather than by field, and that is what decides where Change goes.
 * A person changing a first name expects to land on the page that asks for the name,
 * with the last name beside it, not on a single input in isolation.
 *
 * Only the pages actually walked are shown. A child who lives with the applicant was
 * never asked who else they live with, so listing that question as unanswered would
 * invent a gap in an application that has none.
 */
function CheckPage({ child }: { child: ChildRecord }) {
  const navigate = useNavigate();
  const walked = [...reachableChildSteps(child)];

  return (
    <PublicFormLayout back={SECTION_ROOT} backLabel="Back to your children">
      <FormSet
        heading={`Check ${childLabel(child)}'s details`}
        continueLabel="Continue"
        onContinue={() => navigate(SECTION_ROOT)}
      >
        <FormSummary>
          {walked.map((step) => (
            <SummarySection
              key={step}
              changeTo={stepPath(child.id, step, "child")}
              changeLabel={CHANGE_LABELS[step]}
            >
              {CHILD_STEPS[step].fields.map((field) => (
                <SummaryItem key={field} question={FIELD_LABELS[field]}>
                  {displayValue(field, child)}
                </SummaryItem>
              ))}
            </SummarySection>
          ))}
        </FormSummary>
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* The list                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The section is one question — who are your children — so it is validated as one.
 *
 * Two ways to fail it, and they need different words. Nobody added at all is an
 * unanswered question. Somebody added but not finished is work in progress, and
 * saying which child is unfinished is the difference between an error a person can
 * act on and one they have to go hunting through.
 */
const LIST_SCHEMA: Schema = {
  children: (value) => {
    const items = (value as ChildRecord[]) ?? [];
    if (items.length === 0) return "Add at least one child";
    const unfinished = items.find((c) => !isChildComplete(c));
    return unfinished ? `Finish adding ${childLabel(unfinished)}` : null;
  },
};

function ChildrenList() {
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const { errors, submit, revalidate } = useFormValidation(LIST_SCHEMA);
  const children = state.children;

  const handleAdd = () => {
    const child = emptyChild(newId());
    dispatch({ type: "add-child", child });
    navigate(stepPath(child.id, FIRST_CHILD_STEP, null));
  };

  /** Edit resumes an unfinished child where they stopped, rather than at the start. */
  const handleEdit = (index: number) => {
    const child = children[index];
    const unfinished = firstIncompleteChildStep(child);
    navigate(unfinished ? stepPath(child.id, unfinished, null) : checkPath(child.id));
  };

  const handleRemove = (index: number) => {
    const child = children[index];
    dispatch({ type: "remove-child", id: child.id });
    // Revalidate against what the list is about to become, not what the store still
    // holds: the dispatch has not been applied yet in this render.
    revalidate({ children: children.filter((_, i) => i !== index) });
  };

  /*
   * The list is this task's check-answers page, so its Continue is where the
   * confirmation is recorded — the same press that completes the other three tasks on
   * their own check pages.
   *
   * It needs no separate page. A check page shows every answer with a way to change
   * each one and a Continue that finishes the task, and this list already is that: a
   * row per child, Change and Remove on each, and a rule that will not let the section
   * finish while one is half added. A second page after it would show the same rows
   * again and ask the same question twice.
   */
  const handleContinue = () =>
    submit({ children }, () => {
      dispatch({ type: "confirm-section", id: "your-children" });
      navigate("/");
    });

  /*
   * The row says who, when, and whether it is finished — and deliberately does not
   * repeat what the person typed.
   *
   * An earlier version read "Lives with " + their own words, which produced "Lives
   * with Their grandmother": free text dropped mid-sentence carries whatever casing
   * it was typed with, and no amount of care at the input can fix that. Free text
   * belongs in a field of its own, on the check page, not composed into a sentence
   * someone else wrote half of.
   */
  const items = children.map((child) => ({
    label: childLabel(child),
    detail: isChildComplete(child)
      ? `Born ${formatDate(child.dateOfBirth)} · ${
          child.livesWithYou === "yes" ? "Lives with you" : "Lives with someone else"
        }`
      : "Not finished",
  }));

  return (
    <PublicFormLayout back="/">
      <FormSet
        heading="Your children"
        description="Add each child you are applying for. You can add more than one."
        continueLabel="Save and continue"
        onContinue={handleContinue}
        errors={errors}
      >
        <ItemList
          id="children"
          items={items}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onRemove={handleRemove}
          addLabel="Add a child"
          addAnotherLabel="Add another child"
        />
      </FormSet>
    </PublicFormLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

const PAGES: Record<ChildStepId, (props: { child: ChildRecord }) => ReactElement> = {
  name: NamePage,
  "date-of-birth": DateOfBirthPage,
  "lives-with-you": LivesWithYouPage,
  "living-arrangement": LivingArrangementPage,
};

/**
 * Resolve the child named in the URL, and remount when that child changes.
 *
 * The lookup is the part that earns itself today: a stale or hand-typed id has to
 * land on the list rather than render a page about nobody, and a bookmarked child
 * who has since been removed is a real way to arrive here.
 *
 * The key is insurance, and it is worth being exact about what for, because it is
 * easy to claim more. React Router reuses one component instance when only a route
 * parameter changes, which is how each screener answer once pre-filled the next
 * question. That cannot currently happen in this section: every step is its own
 * component on its own path, and every route between two children passes through the
 * list, which unmounts the page either way. Measured, by removing this key and
 * watching the flow still behave.
 *
 * It stays because the day someone adds a "next child" link — the one navigation
 * that would go child to child without passing the list — the bug arrives silently
 * and looks like a data problem rather than a routing one.
 */
function ByChild({ Page }: { Page: (props: { child: ChildRecord }) => ReactElement }) {
  const { childId } = useParams<{ childId: string }>();
  const { state } = useForm();
  const child = state.children.find((c) => c.id === childId);

  if (!child) return <Navigate to={SECTION_ROOT} replace />;
  return <Page key={child.id} child={child} />;
}

export function YourChildrenSection() {
  return (
    <Routes>
      <Route index element={<ChildrenList />} />

      <Route path=":childId/check" element={<ByChild Page={CheckPage} />} />

      {CHILD_STEP_IDS.map((id) => (
        <Route key={id} path={`:childId/${id}`} element={<ByChild Page={PAGES[id]} />} />
      ))}

      {/* A hand-typed or stale URL lands on the list, not a broken page. */}
      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
