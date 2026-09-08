/**
 * Turning stored answers into the words shown back to a person.
 *
 * Every review page needs this and it is easy to skip, because while the answers are
 * hardcoded the formatting looks like it is already done. The moment answers are
 * real, a date stops being "1 January 1990" and becomes "1990-01-01", a yes/no
 * becomes "yes", and a file becomes an object.
 *
 * Formatting lives here rather than in each page so that a date reads the same on
 * the review page, in a confirmation email and in a caseworker's queue.
 */

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
 * "1990-01-01" becomes "1 January 1990".
 *
 * The date is split by hand rather than passed to `new Date(iso)`, and that is not
 * fussiness. `new Date("1990-01-01")` is parsed as midnight UTC, which in Alberta is
 * the evening of 31 December 1989. Formatting it in local time then shows the wrong
 * day, and only for people west of Greenwich, which is every user of this service.
 *
 * A date of birth has no time and no timezone. Treating it as text avoids inventing
 * either.
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

/** "yes" becomes "Yes". Anything unrecognised comes back untouched. */
export function formatYesNo(value: string | undefined | null): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return value ?? "";
}

/** Digits become "780 123 4567". Anything that is not ten digits is left alone. */
export function formatPhone(value: string | undefined | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Bytes become "2.4 MB". Sizes are shown so people can tell which file is which. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ["a", "b", "c"] becomes "a, b and c". */
export function formatList(items: string[]): string {
  const kept = items.filter((item) => item.trim() !== "");
  if (kept.length === 0) return "";
  if (kept.length === 1) return kept[0];
  return `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`;
}

/**
 * The parts of an address, in the order they would be written on an envelope.
 *
 * Returns lines rather than one joined string so the caller decides how to break
 * them. A review row wants them stacked; a confirmation email may want them inline.
 */
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
