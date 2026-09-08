import type { FormState } from "../lib/form-state";

/**
 * Sending the finished application, and what comes back.
 *
 * THIS IS THE SECOND FILE TO REPLACE. persistence.ts is the first: it owns the
 * part-finished draft. This one owns the single moment the application leaves the
 * browser. Swap the body of submitApplication for a call to your own API and nothing
 * else changes, which is why it is already async and already returns a receipt.
 *
 * The reference number is the part worth reading before you copy anything.
 *
 * IN A REAL SERVICE THE REFERENCE COMES BACK FROM YOUR BACKEND. It is the identifier
 * of a record that now exists somewhere durable, which is exactly what makes it worth
 * quoting on the phone. Generating it in the browser, as this file does, produces a
 * string that refers to nothing: two people could be handed the same one, and neither
 * would find anything behind it.
 *
 * It is generated here anyway, and deliberately, because a confirmation page with no
 * reference on it demonstrates nothing — a service's whole promise at that moment is
 * "here is your proof". A template that showed a bracketed placeholder instead would
 * leave the one page that most needs designing undesigned.
 *
 * This is the opposite trade from the contact details on the result pages, which ARE
 * bracketed placeholders. The difference is who gets hurt: a real-looking email
 * address shipped in a fork sends that fork's users to somebody else's inbox, while a
 * stand-in reference misroutes nobody. Weigh a placeholder by its blast radius, not
 * by a rule about placeholders.
 */

export type Receipt = {
  /** ISO timestamp of the moment the service accepted the application. */
  submittedAt: string;
  /** What the person quotes when they contact the program about this application. */
  reference: string;
};

/**
 * Characters that survive being read aloud, written down, and typed back.
 *
 * No O or 0, no I, 1 or L, no S or 5, no B or 8, no Z or 2. A reference exists to be
 * moved between a screen, a phone call and a keyboard, and every pair above is a
 * place where that trip loses information. Dropping them costs a little entropy and
 * removes a whole class of "the number you gave me does not work".
 */
const UNAMBIGUOUS = "ACDEFGHJKMNPQRTUVWXY34679";

const block = (length: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => UNAMBIGUOUS[byte % UNAMBIGUOUS.length])
    .join("");

/**
 * A reference in three short groups, e.g. ABC-4KMQ-7XTC.
 *
 * Grouped rather than run together because people read, say and re-type it. The
 * leading group is a fixed service prefix, so someone holding references from several
 * programs can tell at a glance which one this is.
 *
 * ABC is a stand-in for your program's short code, in the same spirit as
 * [Service name] in src/lib/service.ts: it keeps the shape a real prefix has while being
 * unmistakably not a real one. A prefix that looked plausible would be shipped
 * unchanged, because there would be nothing visibly wrong with it.
 */
const REFERENCE_PREFIX = "ABC";

function generateReference(): string {
  return `${REFERENCE_PREFIX}-${block(4)}-${block(4)}`;
}

/**
 * Submit the application.
 *
 * The state is taken as an argument even though this implementation ignores it, so
 * that the signature is already right when you replace the body: what you send is the
 * answers, and what you get back is the service's receipt for them.
 */
export async function submitApplication(_state: FormState): Promise<Receipt> {
  return {
    submittedAt: new Date().toISOString(),
    reference: generateReference(),
  };
}
