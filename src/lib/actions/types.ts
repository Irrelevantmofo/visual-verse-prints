export type ActionState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

import type { ZodError } from "zod";

export function zodErrorState(err: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Check the highlighted fields and try again.", fieldErrors };
}
