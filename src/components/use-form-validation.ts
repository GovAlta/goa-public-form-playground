import { useState } from "react";
import { runSchema, type FieldError, type Schema } from "../lib/validation";

/**
 * The React binding over a validation schema. Validates on submit, never as someone
 * types; after a failed submit the rules run on every change so errors clear as they
 * are fixed.
 */
export function useFormValidation(schema: Schema) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const submit = (values: Record<string, unknown>, onValid: () => void) => {
    setSubmitted(true);
    const found = runSchema(schema, values);
    setErrors(found);
    if (found.length === 0) onValid();
  };

  const revalidate = (values: Record<string, unknown>) => {
    if (submitted) setErrors(runSchema(schema, values));
  };

  return { errors, submit, revalidate };
}
