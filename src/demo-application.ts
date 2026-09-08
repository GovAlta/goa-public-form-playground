import type { FormState } from "./lib/form-state";

/**
 * THE SAMPLE APPLICATION THIS DEMO STARTS WITH. DELETE THIS FILE.
 *
 * Deleting it is two steps and the compiler finds the second one for you: remove this
 * file, then remove the import and the fallback in src/store/form-store.tsx that reads
 * it. The "Demo" items in the header menu (src/App.tsx) go at the same time.
 *
 * WHY IT EXISTS. A template is judged by the thing people can see, and the half of this
 * service that is hardest to get right — the review page, the submit, the confirmation,
 * the lock — sits behind about twenty pages of typing. Starting empty means every
 * person evaluating this has to do that typing before they reach anything interesting.
 * So the demo starts part-finished, and clearing it is one menu item away.
 *
 * WHY PART-FINISHED RATHER THAN COMPLETE. The task list's whole job is to say what is
 * done, what is underway and what has not been touched, and it can only demonstrate
 * that if all three are on screen at once. This state puts one section in each:
 *
 *   Check if you can apply   Completed     the screener passed, which unlocks the rest
 *   About you                In progress   name and date of birth answered, contact and
 *                                          address still to do
 *   Your children            Completed     one child, fully answered
 *   Income and documents     Not started   nothing uploaded, nothing answered
 *
 * It is also close to the end, so anyone can finish it in a couple of minutes and see
 * the completed state, the review page and the confirmation for themselves.
 *
 * THE ANSWERS ARE DELIBERATELY OBVIOUS INVENTIONS. Same rule as the bracketed service
 * name: nothing in here should read as a real person's real information, because the
 * one way this file hurts anybody is a fork that ships it by accident.
 */
export const DEMO_APPLICATION: FormState = {
  // Passed: over 18, lives in Alberta, no other program supporting them. Saying no to
  // the last one ends the screener, so there is no follow-up answer to store.
  eligibility: { age: "yes", residency: "yes", otherSupport: "no" },

  // Two of four pages answered. Contact and address are deliberately absent, which is
  // what puts this section In progress and what makes re-entering it land on the
  // contact page rather than at the start.
  aboutYou: {
    firstName: "Ada",
    lastName: "Okonkwo",
    dateOfBirth: "1991-04-08",
  },

  // One child, every question answered, so the section reads Completed. Living with the
  // applicant, so the branch asking who else they live with was never reached.
  children: [
    {
      id: "demo-child-1",
      firstName: "Kit",
      lastName: "Okonkwo",
      dateOfBirth: "2016-09-23",
      livesWithYou: "yes",
    },
  ],

  // Untouched.
  documents: { proofOfIncome: [] },

  // The two tasks whose check-answers page this person has passed through, which is
  // the second half of what makes a task Completed — see FormState.confirmed. Both
  // sections listed here are also fully answered; listing one that was not would show
  // as In progress, because confirming is necessary and never sufficient.
  confirmed: ["eligibility", "your-children"],

  submittedAt: null,
  reference: null,
};
