/**
 * Where a page goes back to when it was reached from a check-answers page's Change
 * link rather than by walking forward. A named origin rather than a path, because a
 * page that navigates wherever the URL says is an open redirect; carried in the URL
 * rather than router state, so a refresh mid-change still returns to the page being
 * checked. See docs/design-notes.md.
 */

export type ReturnTo = "review" | "task" | "child";

export const RETURN_LABELS: Record<ReturnTo, string> = {
  review: "Back to review",
  task: "Back to your answers",
  child: "Back to check answers",
};

/**
 * How the origin is named inside a sentence ("...before you go back to X"). Separate
 * from RETURN_LABELS because a link and a sentence are different registers.
 */
export const RETURN_DESTINATIONS: Record<ReturnTo, string> = {
  review: "your review",
  task: "your answers",
  child: "this child's answers",
};

/**
 * Read the origin out of the URL, ignoring anything this section cannot return to; an
 * unknown origin falls back to null, a normal run through. Generic over `supported` so
 * each section's map of origins to paths is checked by the compiler.
 */
export function readReturnTo<T extends ReturnTo>(
  params: URLSearchParams,
  supported: readonly T[],
): T | null {
  const raw = params.get("from");
  return supported.includes(raw as T) ? (raw as T) : null;
}

export function withReturnTo(path: string, to: ReturnTo | null): string {
  if (!to) return path;
  return `${path}${path.includes("?") ? "&" : "?"}from=${to}`;
}
