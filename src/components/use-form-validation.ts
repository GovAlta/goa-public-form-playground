import { useState } from "react";
import { runSchema, type FieldError, type Schema } from "../lib/validation";

/**
 * The React binding over a validation schema. Owns when validation runs and what
 * the page currently shows.
 *
 * The timing is the whole point, and it is a usability decision rather than a
 * technical one: validate on submit, never as someone types. Telling a person their
 * email is invalid while they are still typing it is telling them they are wrong
 * before they have finished being right. After a failed submit the rules do run on
 * every change, so errors clear as they are fixed.
 */
export function useFormValidation(schema: Schema) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitted, setSubmitted] = useState(false);

  /** Validate now, and run onValid only if everything passes. Call from submit. */
  const submit = (values: Record<string, unknown>, onValid: () => void) => {
    setSubmitted(true);
    const found = runSchema(schema, values);
    setErrors(found);
    if (found.length === 0) onValid();
  };

  /** Re-check after the first failed submit, so errors clear as they are fixed. */
  const revalidate = (values: Record<string, unknown>) => {
    if (submitted) setErrors(runSchema(schema, values));
  };

  return { errors, submit, revalidate };
}
