import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useForm } from "../store/form-store";
import { SECTIONS } from "../lib/sections";

/**
 * Which pages are open, and when they close.
 *
 * Both rules live here rather than inside the pages they govern, and both are routes
 * rather than checks. A page added later is covered by where it is registered instead
 * of by whoever adds it remembering to guard it, and index.tsx shows the whole rule at
 * a glance: everything inside a wrapper obeys it.
 *
 * The thing they both exist for is the same. A task list that greys a row out, or a
 * button that stops being offered, controls only the doors this application draws.
 * The address bar is a door too, and so is the Back button, and so is a bookmark
 * someone made yesterday. A rule enforced only where the UI happens to offer a link
 * is not enforced.
 */

/**
 * Pages that only make sense while the application can still be changed.
 *
 * Once submitted, the answers are a record of what was sent rather than a draft.
 */
export function EditableOnly() {
  const { state } = useForm();

  // `replace` rather than a push, so Back does not bounce between the page they were
  // sent away from and the confirmation they were sent to.
  if (state.submittedAt) {
    return <Navigate to="/confirmation" replace />;
  }

  return <Outlet />;
}

/**
 * Sections the person is not allowed into yet.
 *
 * The screener gates the rest of the application. The task list already shows this by
 * refusing to link a locked row, and the review page by not listing one — but neither
 * of those stops anyone typing the URL, and until this existed nothing did. Someone
 * who bookmarked "About you" during an earlier application could fill in a section
 * the service had decided was shut.
 *
 * The section is worked out from the path against the same registry the task list
 * reads, so a section that changes its route or its unlock rule takes this with it,
 * and a new section is covered the moment it appears in SECTIONS.
 *
 * Sent to the task list rather than to the screener. Being redirected somewhere that
 * explains what is happening beats being redirected somewhere that just starts asking
 * questions — the task list already says "Check if you can apply before you start
 * these", which is the reason they were moved.
 */
export function UnlockedOnly() {
  const { state } = useForm();
  const { pathname } = useLocation();

  const section = SECTIONS.find(
    (candidate) => pathname === candidate.route || pathname.startsWith(`${candidate.route}/`),
  );

  if (section && !section.isUnlocked(state)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
