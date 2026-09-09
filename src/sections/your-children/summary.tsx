// This section's answers shown back, on the review page and on its own check page. One
// card per question page, so a Change link lands on the page that asked; see docs/design-notes.md.
import { FormSummary } from "../../components/form-summary";
import { RepeatingGroupSummary } from "../../components/repeating-group-summary";
import { useForm } from "../../store/form-store";
import { formatDate } from "../../lib/format";
import { childLabel, isChildComplete } from "./rules";

export function YourChildrenSummary() {
  const { state } = useForm();

  return (
    <FormSummary title="Your children">
      {/*
        A repeating group collapses to each child's name and one Change back to the list,
        which manages children and returns to the task list itself, so no returnTo. No
        card title: the section heading already says whose children these are.
      */}
      <RepeatingGroupSummary
        items={state.children.map((child) => ({
          id: child.id,
          label: childLabel(child),
          detail: isChildComplete(child) ? formatDate(child.dateOfBirth) : "Not finished",
        }))}
        emptyText="No children added"
        changeTo="/your-children"
        changeContext="your children"
      />
    </FormSummary>
  );
}
