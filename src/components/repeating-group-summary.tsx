import { ReactNode } from "react";
import { SummarySection } from "./form-summary";

type SummarisedItem = {
  /** Stable id, used as the React key. */
  id: string;
  /** The key identifying field shown on review, usually a name. */
  label: string;
  /** Optional secondary detail, shown muted under the label. */
  detail?: ReactNode;
};

type RepeatingGroupSummaryProps = {
  /**
   * Group title, e.g. "Your children". Optional.
   *
   * Leave it out when the surrounding section already names the group. Two labels
   * for one card read as one sentence to a screen reader, and the empty state is
   * where that shows: a card headed "Children added" holding the words "No children
   * added" announces as "Children added No children added". Nothing looks wrong,
   * because on screen they are two lines.
   */
  title?: string;
  /** The collected items. */
  items: SummarisedItem[];
  /** Text shown when there are no items. */
  emptyText?: string;
  /** One Change/manage action for the whole group, as an action... */
  onChange?: () => void;
  /** ...or as a route. */
  changeTo?: string;
  changeLabel?: string;
  /** What this Change link changes, announced but not shown. See SummarySection. */
  changeContext?: string;
};

/**
 * The review-side view of a repeating group.
 *
 * On review, a repeating group collapses to each item's key identifying field rather
 * than every sub-field, with one Change back to the page where the items are managed.
 * A review page listing eight fields per child for four children is unreadable, and
 * the person only needs to confirm the right people are listed.
 *
 * Composes SummarySection, so it gets the same card, heading and Change action as
 * every other part of the review. Only the body differs: a list of items rather than
 * question and answer rows.
 *
 * Named for the repeating group, not React's children prop. The reference gallery
 * this came from calls it ChildrenSummary; renamed here because "children" already
 * means something else in React, and this service has a section about actual children.
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
