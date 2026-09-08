import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_FORM, formReducer, type FormAction, type FormState } from "../lib/form-state";
import { clearDraft, loadDraft, saveDraft } from "./persistence";
// DEMO ONLY. Delete this import, the file it names, and the fallback below.
import { DEMO_APPLICATION } from "../demo-application";

/**
 * The application's answers, held in one place.
 *
 * Every question page writes here, and the task list and review page read from it.
 * That is the whole reason it exists: without it the task list cannot know which
 * sections are done, and the review page has nothing real to show. Those two pages
 * both need to know how far along the person is, so rather than letting them each
 * guess, they share this.
 *
 * The state and the rules about it live in src/lib and have no React in them. This
 * file is only the binding: it holds the state, and it saves.
 */

type FormContextValue = {
  state: FormState;
  dispatch: (action: FormAction) => void;
};

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, EMPTY_FORM);
  const [hydrated, setHydrated] = useState(false);

  // Read any saved draft once, before anything renders.
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((saved) => {
      if (cancelled) return;
      // DEMO ONLY: the fallback, not the load. A real service starts an unknown
      // visitor on an empty form — delete the second branch and let EMPTY_FORM stand.
      //
      // Nothing saved means nobody has started, which for this demo is the moment to
      // hand them something worth looking at rather than twenty pages of typing. It is
      // also what makes the reset reversible: clearing the answers leaves nothing
      // saved, so the next load comes straight back here.
      dispatch({ type: "hydrate", state: saved ?? DEMO_APPLICATION });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save on every change, but not before the draft has been read.
  //
  // Without this guard the first render would save the empty starting state over a
  // real saved draft, and the person's progress would vanish precisely when they
  // came back to resume it. The bug only shows up on a return visit, which is the
  // one path nobody tests by hand.
  const canSave = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!canSave.current) {
      canSave.current = true;
      return;
    }
    // An untouched form is not a draft, and not saving it is what lets a cleared
    // application come back on the next load: with nothing in storage, the load above
    // falls through to the sample. `reset` returns the EMPTY_FORM object itself, so
    // this identity check is exact and can only be true immediately after a reset.
    if (state === EMPTY_FORM) return;

    void saveDraft(state);
  }, [state, hydrated]);

  // Render nothing until the draft is read. Showing the task list with everything
  // "Not started" and then correcting it a tick later tells the person their work
  // is gone, for just long enough to be alarming.
  if (!hydrated) return null;

  return <FormContext.Provider value={{ state, dispatch }}>{children}</FormContext.Provider>;
}

export function useForm(): FormContextValue {
  const value = useContext(FormContext);
  if (!value) {
    throw new Error("useForm must be used inside a <FormProvider>");
  }
  return value;
}

/**
 * Forget everything and begin an empty application.
 *
 * Both halves, in this order, and the order is the point. With the draft held on a
 * server, forgetting the local copy last would leave the record behind; this is the
 * sequence a real service needs. With the localStorage stand-in the autosave writes
 * an empty draft back a moment later, which reaches the same place by a longer road,
 * so read this as the shape of the call rather than as evidence that both lines are
 * load-bearing here.
 *
 * It lives in one place because it is called from two, and a reset that two pages
 * each implement is a reset those two pages can disagree about.
 */
export async function startNewApplication(dispatch: (action: FormAction) => void): Promise<void> {
  await clearDraft();
  dispatch({ type: "reset" });
}

/** A stable id for a newly added child or document. */
export function newId(): string {
  return crypto.randomUUID();
}
