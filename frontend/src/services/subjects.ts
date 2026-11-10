import { api } from "@/lib/api";
import type { Subject } from "@/types";

export async function listSubjects() {
  const { data } = await api.get<Subject[]>("/subjects");
  return data;
}

export async function getSubject(id: string) {
  const { data } = await api.get<Subject>(`/subjects/${id}`);
  return data;
}

export async function createSubject(payload: {
  name: string;
  description?: string;
  exam_date?: string | null;
  color?: string;
}) {
  const { data } = await api.post<Subject>("/subjects", payload);
  return data;
}

export async function updateSubject(
  id: string,
  payload: Partial<{ name: string; description: string; exam_date: string | null; color: string }>,
) {
  const { data } = await api.patch<Subject>(`/subjects/${id}`, payload);
  return data;
}

export async function deleteSubject(id: string) {
  await api.delete(`/subjects/${id}`);
}
