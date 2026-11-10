import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { getChatSession, listChatSessions, sendChatMessage } from "@/services/assistant";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Citation } from "@/types";
import { getErrorMessage } from "@/lib/utils";

export function AssistantPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"explain" | "examples" | "summarize" | "practice">("explain");

  const sessionsQuery = useQuery({
    queryKey: ["chat-sessions", currentSubjectId],
    queryFn: () => listChatSessions(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  const sessionQuery = useQuery({
    queryKey: ["chat-session", sessionId],
    queryFn: () => getChatSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const chatMutation = useMutation({
    mutationFn: () =>
      sendChatMessage({
        subject_id: currentSubjectId!,
        session_id: sessionId,
        message,
        mode,
      }),
    onSuccess: async (res) => {
      setSessionId(res.session.id);
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-session", res.session.id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!currentSubjectId) {
    return (
      <>
        <PageHeader title="AI Study Assistant" description="Answers grounded in your uploads only." />
        <EmptyState
          icon={MessageSquareText}
          title="Select a subject"
          description="The assistant retrieves only that subject's materials."
        />
      </>
    );
  }

  const messages = sessionQuery.data?.messages ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent className="space-y-2 py-4">
          <p className="text-sm font-medium">Sessions</p>
          {sessionsQuery.isLoading && <Skeleton className="h-16" />}
          <Button variant="outline" className="w-full" onClick={() => setSessionId(null)}>
            New chat
          </Button>
          {sessionsQuery.data?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSessionId(s.id)}
              className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${
                sessionId === s.id ? "bg-muted" : ""
              }`}
            >
              {s.title || "Untitled"}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <PageHeader
          title="AI Study Assistant"
          description="If materials are insufficient, the assistant says so — no fabricated citations."
        />

        <div className="min-h-[320px] space-y-3 rounded-lg border border-border bg-card p-4">
          {!messages.length && (
            <p className="text-sm text-muted-foreground">Ask a question about your uploaded materials.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-md px-3 py-2 text-sm ${
                m.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"
              }`}
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{m.role}</p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {!!m.citations?.length && (
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  {(m.citations as Citation[]).map((c) => (
                    <div key={c.chunk_id}>
                      {c.document_title}
                      {c.page_number != null ? ` · p.${c.page_number}` : ""}
                      {c.section_heading ? ` · ${c.section_heading}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="explain">Explain simply</option>
            <option value="examples">With examples</option>
            <option value="summarize">Summarize</option>
            <option value="practice">Practice questions</option>
          </Select>
          <Textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explain recursion base cases…"
          />
          <Button
            disabled={!message.trim() || chatMutation.isPending}
            onClick={() => chatMutation.mutate()}
          >
            {chatMutation.isPending ? "Thinking…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
