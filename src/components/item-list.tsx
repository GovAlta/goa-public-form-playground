import { ReactNode } from "react";
import { GoabButton } from "@abgov/react-components";

export type ListedItem = {
  /** The item's key identifying field, shown in bold. Usually a name. */
  label: ReactNode;
  /** Secondary detail, shown muted underneath. Usually the other fields, joined. */
  detail?: ReactNode;
};

type ItemListProps = {
  /** The items collected so far. An empty list renders just the add button. */
  items: ListedItem[];
  /** Called with the item's index when Edit is pressed. */
  onEdit: (index: number) => void;
  /** Called with the item's index when Remove is pressed. */
  onRemove: (index: number) => void;
  /** Called when the add button is pressed. */
  onAdd: () => void;
  /** Add button label when the list is empty, e.g. "Add a child". */
  addLabel: string;
  /** Add button label when the list has items, e.g. "Add another child". */
  addAnotherLabel: string;
  /**
   * Id for the wrapping element, so a page-level validation error ("add at least
   * one") can jump here from the error summary.
   */
  id?: string;
};

/**
 * The list of things a person has added, with Edit and Remove on each row and one
 * add button beneath.
 *
 * Every repeating question needs this, whichever way items get added: in a modal, in
 * a drawer, across several steps, or on their own pages. The way items are collected
 * changes; the way they are listed back does not. So this component takes no view on
 * how adding works, and the pages own that.
 */
export function ItemList({
  items,
  onEdit,
  onRemove,
  onAdd,
  addLabel,
  addAnotherLabel,
  id,
}: ItemListProps) {
  return (
    <div id={id}>
      {items.length > 0 && (
        <div style={{ marginBottom: "var(--goa-space-l)" }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "var(--goa-space-m)",
                padding: "var(--goa-space-m) 0",
                borderTop: "1px solid var(--goa-color-greyscale-200)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                {item.detail != null && (
                  <div style={{ color: "var(--goa-color-text-secondary)" }}>{item.detail}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: "var(--goa-space-m)", flexShrink: 0 }}>
                <GoabButton type="tertiary" size="compact" onClick={() => onEdit(i)}>
                  Edit
                </GoabButton>
                <GoabButton type="tertiary" size="compact" onClick={() => onRemove(i)}>
                  Remove
                </GoabButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <GoabButton type="tertiary" leadingIcon="add" onClick={onAdd}>
        {items.length === 0 ? addLabel : addAnotherLabel}
      </GoabButton>
    </div>
  );
}
