/**
 * Validation rules, with no framework in them.
 *
 * A page declares its rules as a schema: field id to rule. Running a schema over a
 * set of values gives back a list of errors, in the order the rules were declared,
 * which is what makes the error summary read top to bottom in field order.
 *
 * Nothing here imports React. That is deliberate. The rules are the part of
 * validation that is genuinely about your service, so they should outlive any
 * decision about how the page is rendered. The React binding lives next door in
 * components/use-form-validation.ts and is about twenty lines.
 */

export type FieldError = {
  /** Id of the GoabFormItem this error belongs to, used to jump to the field. */
  fieldId: string;
  /** The message, shown both in the summary and on the field itself. */
  text: string;
};

/** Given a field's value and every value on the page, return a message or null. */
export type Rule = (value: unknown, all: Record<string, unknown>) => string | null;

/** Rules per field id. The id matches the GoabFormItem id. */
export type Schema = Record<string, Rule>;

export const required =
  (message: string): Rule =>
  (v) => {
    if (typeof v === "string") return v.trim() ? null : message;
    if (Array.isArray(v)) return v.length ? null : message;
    return v ? null : message;
  };

export const minSelected =
  (n: number, message: string): Rule =>
  (v) =>
    Array.isArray(v) && v.length >= n ? null : message;

export const pattern =
  (re: RegExp, message: string): Rule =>
  (v) =>
    typeof v === "string" && re.test(v.trim()) ? null : message;

/**
 * Apply a rule only when a condition holds, otherwise treat the field as valid.
 * For questions revealed by an earlier answer: a hidden field must never block
 * submission with an error nobody can see.
 */
export const when =
  (predicate: (all: Record<string, unknown>) => boolean, rule: Rule): Rule =>
  (v, all) =>
    predicate(all) ? rule(v, all) : null;

/**
 * Run rules in order and report the first failure.
 *
 * This is what lets "you left it blank" and "that is not a valid postal code" be two
 * different messages instead of one that has to cover both. A single rule folding
 * required and format together has to say "Enter a valid postal code" to someone who
 * entered nothing, which tells them their answer was wrong rather than missing.
 */
export const all =
  (...rules: Rule[]): Rule =>
  (v, values) => {
    for (const rule of rules) {
      const message = rule(v, values);
      if (message) return message;
    }
    return null;
  };

/**
 * Apply a rule only when the field has been filled in.
 *
 * An optional field that is answered still has to be answerable: an email address
 * nobody had to give should still be rejected if it is missing its @, because a
 * typo'd optional answer is worse than no answer at all. It is silently unusable.
 */
export const optional =
  (rule: Rule): Rule =>
  (v, values) => {
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    return empty ? null : rule(v, values);
  };

/**
 * The yyyy-mm-dd at the front of a stored date, or null if there isn't one.
 *
 * Deliberately tolerant of a trailing time portion. A date control can hand back a
 * full timestamp, and a date of birth that arrives as "1985-03-27T00:00:00.000Z" is a
 * correctly answered question, not a malformed one. Everything downstream works on
 * the ten characters that mean the day, which is the only part a birthday has.
 */
export function isoDatePart(v: unknown): string | null {
  const value = typeof v === "string" ? v.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Today, in the person's own timezone, as the same YYYY-MM-DD text a date is stored as. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Not in the future.
 *
 * Compared as text rather than as dates, which sorts correctly for YYYY-MM-DD and
 * keeps this free of timezone arithmetic. "Today" is the user's local today, because
 * that is the day they think they are living in.
 *
 * Stays quiet when the value is not a well-formed date, which through a date control
 * can only mean the field is empty — and `required` will already have said so.
 *
 * Lives here rather than beside one section's questions because two sections now ask
 * for a birth date, and a validation rule copied into a second place is a rule that
 * will eventually mean two different things.
 */
export const dateInThePast =
  (message: string): Rule =>
  (v) => {
    const iso = isoDatePart(v);
    if (!iso) return null;
    return iso <= todayIso() ? null : message;
  };

/** Run a schema against values, in declaration order. */
export function runSchema(schema: Schema, values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  for (const [fieldId, rule] of Object.entries(schema)) {
    const message = rule(values[fieldId], values);
    if (message) errors.push({ fieldId, text: message });
  }
  return errors;
}
