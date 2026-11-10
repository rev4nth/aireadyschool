import { api } from "@/lib/api";
import type { GapReport } from "@/types";

export async function listGapReports(subjectId?: string | null) {
  const { data } = await api.get<GapReport[]>("/gap-reports", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function generateGapReport(payload: {
  subject_id: string;
  attempt_id?: string | null;
}) {
  const { data } = await api.post<GapReport>("/gap-reports/generate", payload);
  return data;
}

export async function getGapReport(reportId: string) {
  const { data } = await api.get<GapReport>(`/gap-reports/${reportId}`);
  return data;
}
