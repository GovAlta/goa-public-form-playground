import { ReactNode } from "react";
import { GoabButton } from "@abgov/react-components";

export type ListedItem = {
  label: ReactNode;
  detail?: ReactNode;
};

type ItemListProps = {
  items: ListedItem[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  addAnotherLabel: string;
  /** Id for the wrapper, so a page-level error ("add at least one") can jump here from the error summary. */
  id?: string;
};

/**
 * The list of things a person has added, with Edit and Remove on each row and one add
 * button beneath. Takes no view on how items are added; the pages own that.
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
                  <div style={{ color: "var(--goa-color-text-secondary)" }}>
                    {item.detail}
                  </div>
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
