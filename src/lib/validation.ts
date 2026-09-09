/**
 * Validation rules with no framework in them. A page declares a schema (field id to
 * rule); running it returns errors in declaration order, which is what makes the
 * error summary read top to bottom. The React binding is components/use-form-validation.ts.
 */

export type FieldError = {
  fieldId: string;
  text: string;
};

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
 * Apply a rule only when a condition holds. A question opened by an earlier answer
 * must never block submission with an error nobody can see.
 */
export const when =
  (predicate: (all: Record<string, unknown>) => boolean, rule: Rule): Rule =>
  (v, all) =>
    predicate(all) ? rule(v, all) : null;

/**
 * Run rules in order and report the first failure, so "left blank" and "wrong format"
 * can be two messages instead of one that has to cover both.
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
 * Apply a rule only when the field has been filled in: an optional answer that is
 * given still has to be usable.
 */
export const optional =
  (rule: Rule): Rule =>
  (v, values) => {
    const empty =
      v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    return empty ? null : rule(v, values);
  };

/**
 * The yyyy-mm-dd at the front of a stored date, or null. Tolerant of a trailing time:
 * a date control can hand back a full timestamp, and the day is all a birthday has.
 */
export function isoDatePart(v: unknown): string | null {
  const value = typeof v === "string" ? v.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Not in the future. Compared as text, which sorts correctly for yyyy-mm-dd with no
 * timezone arithmetic; "today" is the person's local day. Quiet on a malformed value,
 * which through a date control means empty, and `required` already says so.
 */
export const dateInThePast =
  (message: string): Rule =>
  (v) => {
    const iso = isoDatePart(v);
    if (!iso) return null;
    return iso <= todayIso() ? null : message;
  };

export function runSchema(schema: Schema, values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  for (const [fieldId, rule] of Object.entries(schema)) {
    const message = rule(values[fieldId], values);
    if (message) errors.push({ fieldId, text: message });
  }
  return errors;
}
