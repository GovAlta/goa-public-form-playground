import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useForm } from "../store/form-store";
import { SECTIONS } from "../lib/sections";

/**
 * Which pages are open, and when they close. Both rules are routes rather than checks,
 * so a page is covered by where it is registered in index.tsx. A task list that greys a
 * row out controls only the doors it draws; the address bar and a bookmark are doors too.
 */

export function EditableOnly() {
  const { state } = useForm();

  // replace, so Back does not bounce between the page and the confirmation.
  if (state.submittedAt) {
    return <Navigate to="/confirmation" replace />;
  }

  return <Outlet />;
}

/**
 * Sections the screener has not opened yet. Resolved against SECTIONS, so a new section
 * is covered the moment it is registered. Sent to the task list rather than the
 * screener, because the task list says why.
 */
export function UnlockedOnly() {
  const { state } = useForm();
  const { pathname } = useLocation();

  const section = SECTIONS.find(
    (candidate) =>
      pathname === candidate.route || pathname.startsWith(`${candidate.route}/`),
  );

  if (section && !section.isUnlocked(state)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
