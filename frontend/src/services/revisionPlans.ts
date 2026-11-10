import { api } from "@/lib/api";
import type { RevisionPlan, RevisionTask, TaskStatus } from "@/types";

export async function listRevisionPlans(subjectId?: string | null) {
  const { data } = await api.get<RevisionPlan[]>("/revision-plans", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function createRevisionPlan(payload: {
  subject_id: string;
  gap_report_id?: string | null;
  title?: string;
  exam_date?: string | null;
  available_days?: number;
  hours_per_day?: number;
  preferences?: Record<string, unknown>;
}) {
  const { data } = await api.post<RevisionPlan>("/revision-plans", payload);
  return data;
}

export async function getRevisionPlan(planId: string) {
  const { data } = await api.get<RevisionPlan>(`/revision-plans/${planId}`);
  return data;
}

export async function listRevisionTasks(planId: string) {
  const { data } = await api.get<RevisionTask[]>(`/revision-plans/${planId}/tasks`);
  return data;
}

export async function updateRevisionTask(
  planId: string,
  taskId: string,
  payload: { completion_status: TaskStatus },
) {
  const { data } = await api.patch<RevisionTask>(
    `/revision-plans/${planId}/tasks/${taskId}`,
    payload,
  );
  return data;
}

export async function recalculateRevisionPlan(planId: string) {
  const { data } = await api.post<RevisionPlan>(`/revision-plans/${planId}/recalculate`);
  return data;
}
