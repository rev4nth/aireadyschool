import { api } from "@/lib/api";
import type { ChatResponse, ChatSession } from "@/types";

export async function listChatSessions(subjectId?: string | null) {
  const { data } = await api.get<ChatSession[]>("/assistant/sessions", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function getChatSession(sessionId: string) {
  const { data } = await api.get<ChatSession>(`/assistant/sessions/${sessionId}`);
  return data;
}

export async function sendChatMessage(payload: {
  subject_id: string;
  topic_id?: string | null;
  session_id?: string | null;
  message: string;
  mode?: "explain" | "examples" | "summarize" | "practice";
}) {
  const { data } = await api.post<ChatResponse>("/assistant/chat", payload);
  return data;
}
