import { api } from "@/lib/api";
import type { Material, MaterialListResponse, ProcessStatus } from "@/types";

export async function listMaterials(subjectId?: string | null) {
  const { data } = await api.get<MaterialListResponse>("/materials", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function getMaterial(id: string) {
  const { data } = await api.get<Material>(`/materials/${id}`);
  return data;
}

export async function uploadMaterial(params: {
  subjectId: string;
  file: File;
  docType?: string;
  title?: string;
  onProgress?: (pct: number) => void;
}) {
  const form = new FormData();
  form.append("subject_id", params.subjectId);
  form.append("doc_type", params.docType || "notes");
  if (params.title) form.append("title", params.title);
  form.append("file", params.file);

  const { data } = await api.post<Material>("/materials/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!params.onProgress || !event.total) return;
      params.onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function createTextMaterial(payload: {
  subject_id: string;
  title: string;
  content: string;
  doc_type?: string;
}) {
  const { data } = await api.post<Material>("/materials/text", payload);
  return data;
}

export async function reprocessMaterial(id: string) {
  const { data } = await api.post<ProcessStatus>(`/materials/${id}/process`);
  return data;
}

export async function getMaterialStatus(id: string) {
  const { data } = await api.get<ProcessStatus>(`/materials/${id}/status`);
  return data;
}

export async function deleteMaterial(id: string) {
  await api.delete(`/materials/${id}`);
}
