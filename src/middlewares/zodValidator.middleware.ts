import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema, z } from "zod";

/**
 * A type-safe wrapper for zValidator that returns a consistent 400 error format.
 */
function prettyValidator<T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join(".") || target,
            message: issue.message,
          })),
        },
        400,
      );
    }
  });
}

export default prettyValidator;
