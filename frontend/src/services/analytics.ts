import { api } from "@/lib/api";
import type { AnalyticsData } from "@/types";

export async function getAnalytics(subjectId?: string | null) {
  const { data } = await api.get<AnalyticsData>("/analytics", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}
