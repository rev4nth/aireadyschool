import { api } from "@/lib/api";
import type { DashboardData, ProgressOverview } from "@/types";

export async function getProgressOverview(subjectId?: string | null) {
  const { data } = await api.get<ProgressOverview>("/progress/overview", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function getDashboard(subjectId?: string | null) {
  const { data } = await api.get<DashboardData>("/progress/dashboard", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}
