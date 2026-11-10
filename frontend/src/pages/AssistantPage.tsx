import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Citation } from "@/types";
import { getErrorMessage } from "@/lib/utils";

export function AssistantPage() {
  const location = useLocation();
  const { currentSubjectId, currentSubject } = useSubject();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"explain" | "examples" | "summarize" | "practice">("explain");

  const subjectName = currentSubject?.name || "this subject";

  useEffect(() => {
    setSessionId(null);
    setMessage("");
  }, [currentSubjectId]);

  useEffect(() => {
    const suggestedPrompt = (location.state as { suggestedPrompt?: string } | null)?.suggestedPrompt;
    if (suggestedPrompt) setMessage(suggestedPrompt);
  }, [location.state]);

  const suggested = useMemo(() => {
    const base = subjectName.toLowerCase();
    if (base.includes("biology") || base.includes("photo")) {
      return [
        "Explain the light reaction simply using my notes.",
        "What is the difference between the light reaction and Calvin cycle?",
        "Where does glycolysis happen, according to my materials?",
        "Quiz me on chloroplasts from my uploaded notes.",
      ];
    }
    if (base.includes("data") || base.includes("structure") || base.includes("computer")) {
      return [
        "Explain stack LIFO using only my notes.",
        "What is the difference between a stack and a queue?",
        "When can I use binary search?",
        "Give me a practice question on arrays from my materials.",
      ];
    }
    return [
      `Explain my weakest topic in ${subjectName} using only my uploads.`,
      `Summarize the most exam-important ideas in ${subjectName}.`,
      `Give me a practice question grounded in my ${subjectName} notes.`,
      `What misconceptions should I watch for in ${subjectName}?`,
    ];
  }, [subjectName]);

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
          <p className="text-xs text-muted-foreground">{subjectName}</p>
          {sessionsQuery.isLoading && <Skeleton className="h-16" />}
          {sessionsQuery.isError ? (
            <ErrorState
              className="py-4"
              description={getErrorMessage(sessionsQuery.error)}
              onRetry={() => void sessionsQuery.refetch()}
            />
          ) : null}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSessionId(null);
              setMessage("");
            }}
          >
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
          title="Your AI Study Assistant"
          description={`Ask about ${subjectName}. Answers use your uploaded materials with citations.`}
        />

        <div className="min-h-[360px] space-y-3 rounded-xl border border-border bg-card p-4">
          {!messages.length ? (
            <div className="space-y-4 py-6">
              <div>
                <p className="text-base font-semibold">Hello — I’m your GapFinder study assistant.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  I explain concepts, clarify mistakes, and stay grounded in your {subjectName} materials.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggested.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => setMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"
              }`}
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{m.role}</p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {!!m.citations?.length && (
                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-medium text-foreground">Sources from your materials</p>
                  {(m.citations as Citation[]).map((c) => (
                    <details key={c.chunk_id} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                      <summary className="cursor-pointer font-medium">
                        {c.document_title || "Uploaded material"}
                        {c.section_heading ? ` · ${c.section_heading}` : ""}
                        {c.page_number != null ? ` · p.${c.page_number}` : ""}
                      </summary>
                      {c.excerpt ? (
                        <p className="mt-1 text-muted-foreground">“{c.excerpt}”</p>
                      ) : (
                        <p className="mt-1 text-muted-foreground">Citation linked to a retrieved chunk.</p>
                      )}
                    </details>
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
            placeholder={`Ask anything about ${subjectName} using your uploads…`}
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
