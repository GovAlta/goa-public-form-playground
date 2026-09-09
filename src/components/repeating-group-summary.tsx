import { ReactNode } from "react";
import { SummarySection } from "./form-summary";

type SummarisedItem = {
  id: string;
  label: string;
  detail?: ReactNode;
};

type RepeatingGroupSummaryProps = {
  /**
   * Group title. Leave it out when the surrounding section already names the group:
   * two labels on one card read as one sentence to a screen reader ("Children added No
   * children added").
   */
  title?: string;
  items: SummarisedItem[];
  emptyText?: string;
  onChange?: () => void;
  changeTo?: string;
  changeLabel?: string;
  changeContext?: string;
};

/**
 * The review-side view of a repeating group: each item's identifying field rather than
 * every sub-field, with one Change back to the page where the items are managed.
 * Composes SummarySection so it matches the rest of the review.
 */
export function RepeatingGroupSummary({
  title,
  items,
  emptyText = "None added",
  onChange,
  changeTo,
  changeLabel,
  changeContext,
}: RepeatingGroupSummaryProps) {
  return (
    <SummarySection
      heading={title}
      onChange={onChange}
      changeTo={changeTo}
      changeLabel={changeLabel}
      changeContext={changeContext}
    >
      {items.length === 0 ? (
        <span style={{ color: "var(--goa-color-text-secondary)" }}>{emptyText}</span>
      ) : (
        items.map((it) => (
          <div key={it.id} style={{ padding: "var(--goa-space-2xs) 0" }}>
            <div>
              <strong>{it.label}</strong>
            </div>
            {it.detail != null && (
              <div style={{ color: "var(--goa-color-text-secondary)" }}>{it.detail}</div>
            )}
          </div>
        ))
      )}
    </SummarySection>
  );
}
