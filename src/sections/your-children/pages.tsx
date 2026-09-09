import { useState, type ReactElement } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
} from "./rules";
import type { ChildRecord } from "../../lib/form-state";
import {
  RETURN_LABELS,
  readReturnTo,
  withReturnTo,
  type ReturnTo,
} from "../../lib/return-to";
import { newId, useForm } from "../../store/form-store";

/**
 * Your children: a repeating group, one child at a time across question pages. The
 * graph and the walkers are in rules.ts; this file is the pages and routing.
 * Answers save page by page, so a child abandoned halfway is a real, unfinished row
 * with Remove on it rather than work lost on a refresh. See docs/design-notes.md.
 */

const SECTION_ROOT = "/your-children";

/**
 * Only "child": the list is this task's check page, and a question here is never
 * reached from the whole-application review. See lib/return-to.ts.
 */
const SUPPORTED = ["child"] as const;

const stepPath = (childId: string, step: ChildStepId, returnTo: ReturnTo | null) =>
  withReturnTo(`${SECTION_ROOT}/${childId}/${step}`, returnTo);

const checkPath = (childId: string) => `${SECTION_ROOT}/${childId}/check`;

/** Typed over every field, so adding one to ChildRecord fails the build until it has a label. */
const FIELD_LABELS: Record<ChildField, string> = {
  firstName: "First name",
  lastName: "Last name",
  dateOfBirth: "Date of birth",
  livesWithYou: "Lives with you",
  // Not "Lives with": under "Lives with you" it read as the same question twice.
  livingArrangement: "Who they live with",
};

/** Each link names its target, so a list of links heard out of context is not "Change, Change, Change". */
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

/**
 * A draft seeded from the stored child, validated on submit. The draft is separate from
 * the store so a half-typed answer abandoned with Back is not saved; unlike About you
 * the record already exists, so Back leaves an unfinished child rather than nothing.
 */
function useChildStep(step: ChildStepId, child: ChildRecord) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dispatch } = useForm();
  const config = CHILD_STEPS[step];

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
      // Prune first, so an answer the new path no longer reaches cannot reappear later.
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

function NamePage({ child }: { child: ChildRecord }) {
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
  } = useChildStep("name", child);

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
            // "off", not "given-name": WCAG 1.3.5 covers the user's own details, and a
            // name token here would fill the applicant's name into their child's.
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
  } = useChildStep("date-of-birth", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/* GoabDatePicker takes no ariaLabel and names its inner fields nothing, so the
            h1 is the only place this question reaches a screen reader. */}
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
  } = useChildStep("lives-with-you", child);

  return (
    <PublicFormLayout back={back} backLabel={backLabel}>
      <FormSet
        heading={heading}
        continueLabel={continueLabel}
        onContinue={handleContinue}
        errors={errors}
      >
        {/* One question: the heading asks it, so no visible label; the group's ariaLabel
            carries the heading, since nothing else here names the group. */}
        <GoabFormItem
          id="livesWithYou"
          type="radio-group"
          error={errorFor("livesWithYou")}
        >
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
  } = useChildStep("living-arrangement", child);

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

/**
 * The child's own check page. Cards are grouped by page, so Change lands on the page
 * that asked; only the pages actually walked are shown, so a child who lives with the
 * applicant is not shown an unanswered question they were never asked.
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

/** The section validates as one question, with two failures worded apart: nobody added, or a named child unfinished. */
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
    // Revalidate against the list as it will be: the dispatch has not applied in this render.
    revalidate({ children: children.filter((_, i) => i !== index) });
  };

  // The list is this task's check page, so its Continue records the confirmation;
  // a separate check page would only show the same rows again.
  const handleContinue = () =>
    submit({ children }, () => {
      dispatch({ type: "confirm-section", id: "your-children" });
      navigate("/");
    });

  // The row never quotes free text: "Lives with " + their own words produced "Lives
  // with Their grandmother". Free text belongs in its own field on the check page.
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

const PAGES: Record<ChildStepId, (props: { child: ChildRecord }) => ReactElement> = {
  name: NamePage,
  "date-of-birth": DateOfBirthPage,
  "lives-with-you": LivesWithYouPage,
  "living-arrangement": LivingArrangementPage,
};

/**
 * Resolves the child in the URL; a stale or hand-typed id lands on the list. The key
 * remounts the page per child: not needed today, since every route between children
 * passes through the list, but a future child-to-child link would carry state across.
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

      <Route path="*" element={<Navigate to={SECTION_ROOT} replace />} />
    </Routes>
  );
}
