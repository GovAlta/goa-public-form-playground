/**
 * What this service is called, and the first thing to change.
 *
 * It ships as a bracketed placeholder rather than as a plausible service name, and
 * that is deliberate. Everything else in this template is realistic on purpose: the
 * questions, the branches, the validation, the review page. Those teach. A name does
 * not teach, and a plausible one carries a real risk, because a fork deployed with
 * "Apply for financial support" under the Alberta header is a realistic-looking
 * Government of Alberta service that is not one.
 *
 * The general rule, which the contact details and the reference prefix also follow:
 * the service's IDENTITY ships as a placeholder, its SUBSTANCE ships realistic. Weigh
 * each stand-in by what it costs if somebody ships it unchanged.
 *
 * The bracket is also the instruction. Anyone who clones this and runs it sees
 * [Service name] in the header and knows what to do without opening the README.
 *
 * It lives here, in the framework-neutral core, rather than beside the header that
 * renders it, so that the Playwright suite can import it without loading React. That
 * leaves exactly one unavoidable copy, in index.html's <title>, which renders before
 * any JavaScript and so cannot read this file. scripts/readme.test.ts asserts the two
 * are equal, which is the only thing keeping a fork's browser tab from still saying
 * somebody else's service name.
 */
export const SERVICE_NAME = "[Service name]";
