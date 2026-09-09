import type { FormState } from "../lib/form-state";

/**
 * The single moment the application leaves the browser: the second seam, after
 * persistence.ts. Replace the body of submitApplication with a call to your own API; it
 * is already async and returns a receipt. It does not handle failure; that catch belongs
 * in src/routes/review-page.tsx. The reference is generated here only so the
 * confirmation page has something to show; a real one comes from your backend.
 */

export type Receipt = {
  submittedAt: string;
  reference: string;
};

/** No O/0, I/1/L, S/5, B/8 or Z/2: a reference has to survive being read aloud and typed back. */
const UNAMBIGUOUS = "ACDEFGHJKMNPQRTUVWXY34679";

const block = (length: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => UNAMBIGUOUS[byte % UNAMBIGUOUS.length])
    .join("");

/**
 * Three short groups, e.g. ABC-4KMQ-7XTC, because people read, say and re-type it. ABC is
 * a stand-in for your program's short code, like [Service name] in src/lib/service.ts.
 */
const REFERENCE_PREFIX = "ABC";

function generateReference(): string {
  return `${REFERENCE_PREFIX}-${block(4)}-${block(4)}`;
}

/** Submit the application. The state is taken even though this stand-in ignores it, so the signature is already right when you replace the body. */
export async function submitApplication(_state: FormState): Promise<Receipt> {
  return {
    submittedAt: new Date().toISOString(),
    reference: generateReference(),
  };
}
