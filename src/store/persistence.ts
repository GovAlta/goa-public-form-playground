import { EMPTY_FORM, type FormState } from "../lib/form-state";

/**
 * Where a part-finished application is kept between visits.
 *
 * THIS IS THE FILE TO REPLACE. It is the only place in the application that knows
 * where drafts live. Swap these three functions for calls to your own API and
 * nothing else has to change: they are already async for exactly that reason.
 *
 * A warning about what is here now. Saving to the browser is a stand-in so the
 * template works with no backend, not a recommendation. A part-finished benefits
 * application is personal information about someone and often about their children,
 * and localStorage is a poor home for it: it is readable by any script on the
 * origin, it survives sign-out, and it stays on a shared or public computer after
 * the person walks away.
 *
 * Where real draft answers live is a decision for your service and your privacy
 * reviewers, and it is worth making deliberately rather than inheriting from a
 * template.
 */

const STORAGE_KEY = "goa-public-form-draft";

/** Save the whole draft. Called on every change to the form. */
export async function saveDraft(state: FormState): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable: private browsing, a full quota, a blocked origin.
    // Losing the draft is bad, but a crash mid-application is worse, and the person
    // can still finish in this sitting. A real service should surface this, because
    // silently not saving is the one failure people never forgive.
  }
}

/** Read the saved draft, or null when there is nothing to resume. */
export async function loadDraft(): Promise<FormState | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Anything could be in storage: an older version of this app, a half-written
    // value, something a person edited by hand. Merging onto a known-good shape
    // means a missing key cannot crash a page that expects it to exist.
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return {
      ...EMPTY_FORM,
      ...parsed,
      documents: { ...EMPTY_FORM.documents, ...parsed.documents },
      children: Array.isArray(parsed.children) ? parsed.children : [],
      confirmed: Array.isArray(parsed.confirmed) ? parsed.confirmed : [],
    };
  } catch {
    return null;
  }
}

/** Forget the draft. Called after a successful submit. */
export async function clearDraft(): Promise<void> {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do, and nothing worth interrupting the person over.
  }
}
