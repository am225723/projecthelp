"use server";

import { runTriage } from "@/lib/triage-service";

export async function runTriageAction() {
  const result = await runTriage();

  if (!result.ok) {
    throw new Error(result.error || "Failed to run triage");
  }

  return result;
}
