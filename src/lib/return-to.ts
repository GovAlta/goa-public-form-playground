/**
 * Where a page goes back to when it was not reached by walking forward.
 *
 * Most pages in this service are reached in order, so Back is the previous question
 * and Continue is the next one. Some are not: a Change link on a check-answers page
 * drops a person into the middle of a section, and both Back and Continue then have
 * to return them to the page they came from rather than resuming the walk.
 *
 * WHY A NAMED ORIGIN AND NOT A PATH. The obvious encoding is `?from=/review` — carry
 * the destination and navigate to it. Do not. A page that navigates to whatever the
 * URL tells it to is an open redirect, and a template is copied: the idiom would
 * arrive one day in a service where the target is not a route in the same app. A
 * closed set of names cannot do that, and it also cannot break when a route is
 * renamed, because each section resolves the name against its own paths.
 *
 * WHY THE URL AND NOT ROUTER STATE. Router state does not survive a refresh. Someone
 * who reloads mid-change would otherwise be silently dropped back into a normal run
 * and sent onward instead of back to the page they were checking.
 */

export type ReturnTo =
  /** The whole application's check-answers page, /review. */
  | "review"
  /** This task's own check-answers page. Each section knows where its own is. */
  | "task"
  /** One child's check page, inside the Your children sub-flow. */
  | "child";

/**
 * What the back link says. The same words wherever the origin is the same, because a
 * person moving between sections should not have to learn a new label in each.
 */
export const RETURN_LABELS: Record<ReturnTo, string> = {
  review: "Back to review",
  task: "Back to your answers",
  child: "Back to check answers",
};

/**
 * How the origin is named inside a sentence: "...before you go back to X".
 *
 * Separate from RETURN_LABELS because a link and a sentence are different registers.
 * "Back to review" is a signpost; "before you go back to your review" is prose, and
 * dropping the signpost into the sentence reads as a pasted-in button.
 */
export const RETURN_DESTINATIONS: Record<ReturnTo, string> = {
  review: "your review",
  task: "your answers",
  child: "this child's answers",
};

/**
 * Read the origin out of the URL, ignoring anything this section cannot return to.
 *
 * `supported` is not defensive clutter: a hand-typed or stale URL naming an origin a
 * section has no page for would otherwise resolve to undefined and navigate nowhere.
 * Falling back to null means the page behaves as a normal run through, which is the
 * only safe answer to "I do not know where you came from".
 *
 * Generic over that list on purpose, so `readReturnTo(params, ["review", "task"])`
 * is typed as `"review" | "task" | null` rather than as the whole union. That is what
 * makes each section's map of origins to paths provably exhaustive: declaring an
 * origin the section has no path for stops compiling, instead of navigating to
 * undefined at runtime in the one flow nobody re-tests.
 */
export function readReturnTo<T extends ReturnTo>(
  params: URLSearchParams,
  supported: readonly T[],
): T | null {
  const raw = params.get("from");
  return supported.includes(raw as T) ? (raw as T) : null;
}

/** Add the origin to a path, or leave the path alone when there is not one. */
export function withReturnTo(path: string, to: ReturnTo | null): string {
  if (!to) return path;
  return `${path}${path.includes("?") ? "&" : "?"}from=${to}`;
}
