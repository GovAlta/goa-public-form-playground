import { EMPTY_FORM, type FormState } from "../lib/form-state";

/**
 * Where a part-finished application is kept between visits: the first seam. Replace
 * these three functions with calls to your own API; they are already async. localStorage
 * is a stand-in, not a recommendation: a draft is personal information, and this storage
 * is readable by any script on the origin, survives sign-out, and stays on a shared computer.
 */

const STORAGE_KEY = "goa-public-form-draft";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function saveDraft(state: FormState): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private browsing, a full quota); the draft is lost but
    // the sitting continues. A real service should surface this: silently not saving is
    // the failure people never forgive.
  }
}

export async function loadDraft(): Promise<FormState | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Storage can hold an older shape or a hand-edited value. Merging onto EMPTY_FORM key
    // by key means a missing key cannot crash a page, and a new section needs no line here.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft: Record<string, unknown> = { ...EMPTY_FORM };
    for (const [key, fallback] of Object.entries(EMPTY_FORM)) {
      const saved = parsed[key];
      if (Array.isArray(fallback)) draft[key] = Array.isArray(saved) ? saved : fallback;
      else if (fallback && typeof fallback === "object")
        draft[key] = isRecord(saved) ? { ...fallback, ...saved } : fallback;
      else if (saved !== undefined) draft[key] = saved;
    }
    return draft as FormState;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do, and nothing worth interrupting the person over.
  }
}
