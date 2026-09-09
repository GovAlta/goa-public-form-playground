import type { FormState } from "./lib/form-state";

/**
 * The demo's starting answers. Delete this file, then the `?? DEMO_APPLICATION` fallback
 * in src/store/form-store.tsx and the Demo item in src/App.tsx; the compiler finds the rest.
 */
export const DEMO_APPLICATION: FormState = {
  eligibility: { age: "yes", residency: "yes", otherSupport: "no" },

  aboutYou: {
    firstName: "Ada",
    lastName: "Okonkwo",
    dateOfBirth: "1991-04-08",
  },

  children: [
    {
      id: "demo-child-1",
      firstName: "Kit",
      lastName: "Okonkwo",
      dateOfBirth: "2016-09-23",
      livesWithYou: "yes",
    },
  ],

  documents: { proofOfIncome: [] },

  // Confirmed on their check pages, the second half of Completed (see FormState.confirmed).
  confirmed: ["eligibility", "your-children"],

  submittedAt: null,
  reference: null,
};
