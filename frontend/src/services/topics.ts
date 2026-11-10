import { api } from "@/lib/api";
import type { Topic, TopicMapResponse } from "@/types";

export async function listTopics(subjectId: string) {
  const { data } = await api.get<TopicMapResponse>("/topics", {
    params: { subject_id: subjectId },
  });
  return data;
}

export async function generateTopicMap(subjectId: string) {
  const { data } = await api.post<TopicMapResponse>("/topics/generate", {
    subject_id: subjectId,
  });
  return data;
}

export async function updateTopic(
  topicId: string,
  payload: Partial<{
    name: string;
    description: string | null;
    parent_id: string | null;
    exam_importance: number;
    past_paper_frequency: number;
  }>,
) {
  const { data } = await api.patch<Topic>(`/topics/${topicId}`, payload);
  return data;
}

export async function getTopicMaterials(topicId: string) {
  const { data } = await api.get<{
    topic_id: string;
    documents: Array<{ id: string; title: string; doc_type: string; relevance_score?: number }>;
    chunks: Array<{ chunk_id: string; document_id: string }>;
  }>(`/topics/${topicId}/materials`);
  return data;
}
