import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubject } from "@/contexts/SubjectContext";
import { listMaterials } from "@/services/materials";
import { listTopics } from "@/services/topics";
import { listQuizzes } from "@/services/quizzes";
import { listRevisionPlans } from "@/services/revisionPlans";
import { listChatSessions } from "@/services/assistant";
import type { Topic } from "@/types";

export type SearchHit = {
  id: string;
  kind: "material" | "topic" | "quiz" | "revision" | "conversation";
  title: string;
  subtitle?: string;
  href: string;
};

function flattenTopics(topics: Topic[], acc: Topic[] = []): Topic[] {
  for (const t of topics) {
    acc.push(t);
    if (t.children?.length) flattenTopics(t.children, acc);
  }
  return acc;
}

export function useGlobalSearch() {
  const { currentSubjectId } = useSubject();
  const [query, setQuery] = useState("");
  const enabled = Boolean(currentSubjectId) && query.trim().length >= 2;

  const materialsQuery = useQuery({
    queryKey: ["search-materials", currentSubjectId],
    queryFn: () => listMaterials(currentSubjectId),
    enabled: Boolean(currentSubjectId),
    staleTime: 30_000,
  });
  const topicsQuery = useQuery({
    queryKey: ["search-topics", currentSubjectId],
    queryFn: () => listTopics(currentSubjectId!),
    enabled: Boolean(currentSubjectId),
    staleTime: 30_000,
  });
  const quizzesQuery = useQuery({
    queryKey: ["search-quizzes", currentSubjectId],
    queryFn: () => listQuizzes(currentSubjectId),
    enabled: Boolean(currentSubjectId),
    staleTime: 30_000,
  });
  const plansQuery = useQuery({
    queryKey: ["search-plans", currentSubjectId],
    queryFn: () => listRevisionPlans(currentSubjectId),
    enabled: Boolean(currentSubjectId),
    staleTime: 30_000,
  });
  const sessionsQuery = useQuery({
    queryKey: ["search-sessions", currentSubjectId],
    queryFn: () => listChatSessions(currentSubjectId!),
    enabled: Boolean(currentSubjectId),
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as SearchHit[];

    const hits: SearchHit[] = [];

    for (const m of materialsQuery.data?.items ?? []) {
      if (m.title.toLowerCase().includes(q) || (m.file_name ?? "").toLowerCase().includes(q)) {
        hits.push({
          id: `m-${m.id}`,
          kind: "material",
          title: m.title,
          subtitle: `${m.doc_type} · ${m.status}`,
          href: "/materials",
        });
      }
    }

    for (const t of flattenTopics(topicsQuery.data?.topics ?? [])) {
      if (t.name.toLowerCase().includes(q)) {
        hits.push({
          id: `t-${t.id}`,
          kind: "topic",
          title: t.name,
          subtitle: "Topic map",
          href: "/topics",
        });
      }
    }

    for (const quiz of quizzesQuery.data ?? []) {
      if (quiz.title.toLowerCase().includes(q)) {
        hits.push({
          id: `q-${quiz.id}`,
          kind: "quiz",
          title: quiz.title,
          subtitle: `${quiz.question_count} questions`,
          href: "/quiz",
        });
      }
    }

    for (const plan of plansQuery.data ?? []) {
      const label = `Revision plan · ${plan.status}`;
      if (label.toLowerCase().includes(q) || "revision".includes(q) || "plan".includes(q)) {
        hits.push({
          id: `p-${plan.id}`,
          kind: "revision",
          title: label,
          subtitle: `${plan.tasks?.length ?? 0} tasks`,
          href: "/revision",
        });
      }
    }

    for (const session of sessionsQuery.data ?? []) {
      const title = session.title || "Conversation";
      if (title.toLowerCase().includes(q)) {
        hits.push({
          id: `s-${session.id}`,
          kind: "conversation",
          title,
          subtitle: "AI Study Assistant",
          href: "/assistant",
        });
      }
    }

    return hits.slice(0, 12);
  }, [
    query,
    materialsQuery.data,
    topicsQuery.data,
    quizzesQuery.data,
    plansQuery.data,
    sessionsQuery.data,
  ]);

  return {
    query,
    setQuery,
    results,
    enabled,
    loading:
      enabled &&
      (materialsQuery.isLoading ||
        topicsQuery.isLoading ||
        quizzesQuery.isLoading ||
        plansQuery.isLoading ||
        sessionsQuery.isLoading),
  };
}
