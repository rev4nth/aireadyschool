import type { MasteryClass } from "@/types";

export function masteryLabel(classification: string | null | undefined): string {
  switch (classification) {
    case "strong":
      return "Strong";
    case "medium":
      return "Medium";
    case "weak":
      return "Weak";
    case "not_assessed":
      return "Not assessed";
    default:
      return "Not assessed";
  }
}

export function normalizeMastery(
  classification: string | null | undefined,
  questionsAttempted?: number | null,
): MasteryClass {
  if ((questionsAttempted ?? 0) <= 0 || classification === "not_assessed" || !classification) {
    return "not_assessed";
  }
  if (classification === "weak" || classification === "medium" || classification === "strong") {
    return classification;
  }
  return "not_assessed";
}

export function masteryBadgeVariant(
  classification: string | null | undefined,
): "success" | "warning" | "danger" | "muted" {
  const normalized = normalizeMastery(classification);
  if (normalized === "strong") return "success";
  if (normalized === "medium") return "warning";
  if (normalized === "weak") return "danger";
  return "muted";
}
