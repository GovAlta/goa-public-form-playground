const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "1990-01-01" becomes "1 January 1990". Split by hand rather than `new Date(iso)`,
 * which parses as midnight UTC and shows the previous day anywhere west of Greenwich.
 * A date of birth has no time and no timezone.
 */
export function formatDate(value: string | undefined | null): string {
  if (!value) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;

  return `${Number(day)} ${monthName} ${year}`;
}

export function formatYesNo(value: string | undefined | null): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return value ?? "";
}

export function formatPhone(value: string | undefined | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatList(items: string[]): string {
  const kept = items.filter((item) => item.trim() !== "");
  if (kept.length === 0) return "";
  if (kept.length === 1) return kept[0];
  return `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`;
}

export function formatAddressLines(address: {
  street?: string;
  suite?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}): string[] {
  const present = (value?: string) => Boolean(value?.trim());
  // Canada Post puts the unit ahead of the street number on one line. Written as its
  // own line it reads as a second address.
  const streetLine = present(address.suite)
    ? `${address.suite?.trim()}-${address.street?.trim() ?? ""}`.replace(/-$/, "")
    : address.street;
  const cityLine = [address.city, address.province].filter(present).join(", ");

  return [streetLine, cityLine, address.postalCode]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}
