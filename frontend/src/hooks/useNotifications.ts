import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubject } from "@/contexts/SubjectContext";
import { listMaterials } from "@/services/materials";
import { listQuizzes } from "@/services/quizzes";
import { listGapReports } from "@/services/gapReports";
import { listRevisionPlans } from "@/services/revisionPlans";
import { getDashboard } from "@/services/progress";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt?: string | null;
  tone: "info" | "success" | "warning" | "danger";
};

export function useNotifications() {
  const { currentSubjectId } = useSubject();
  const enabled = Boolean(currentSubjectId);

  const materialsQuery = useQuery({
    queryKey: ["notif-materials", currentSubjectId],
    queryFn: () => listMaterials(currentSubjectId),
    enabled,
    staleTime: 20_000,
  });
  const quizzesQuery = useQuery({
    queryKey: ["notif-quizzes", currentSubjectId],
    queryFn: () => listQuizzes(currentSubjectId),
    enabled,
    staleTime: 20_000,
  });
  const gapsQuery = useQuery({
    queryKey: ["notif-gaps", currentSubjectId],
    queryFn: () => listGapReports(currentSubjectId),
    enabled,
    staleTime: 20_000,
  });
  const plansQuery = useQuery({
    queryKey: ["notif-plans", currentSubjectId],
    queryFn: () => listRevisionPlans(currentSubjectId),
    enabled,
    staleTime: 20_000,
  });
  const dashboardQuery = useQuery({
    queryKey: ["notif-dashboard", currentSubjectId],
    queryFn: () => getDashboard(currentSubjectId),
    enabled,
    staleTime: 20_000,
  });

  const notifications = useMemo(() => {
    const items: AppNotification[] = [];

    for (const m of materialsQuery.data?.items ?? []) {
      if (m.status === "processed") {
        items.push({
          id: `mat-ok-${m.id}`,
          title: "Material ready",
          body: `“${m.title}” is processed and searchable.`,
          href: "/materials",
          createdAt: m.updated_at ?? m.created_at,
          tone: "success",
        });
      } else if (m.status === "failed") {
        items.push({
          id: `mat-fail-${m.id}`,
          title: "Processing failed",
          body: m.error_message || `“${m.title}” could not be processed.`,
          href: "/materials",
          createdAt: m.updated_at ?? m.created_at,
          tone: "danger",
        });
      } else if (m.status === "processing" || m.status === "pending") {
        items.push({
          id: `mat-busy-${m.id}`,
          title: "Processing material",
          body: `“${m.title}” is being prepared for quizzes and topics.`,
          href: "/materials",
          createdAt: m.updated_at ?? m.created_at,
          tone: "warning",
        });
      }
    }

    const latestQuiz = [...(quizzesQuery.data ?? [])].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    )[0];
    if (latestQuiz) {
      items.push({
        id: `quiz-${latestQuiz.id}`,
        title: "Diagnostic available",
        body: `“${latestQuiz.title}” · ${latestQuiz.question_count} questions`,
        href: "/quiz",
        createdAt: latestQuiz.created_at,
        tone: "info",
      });
    }

    const latestGap = [...(gapsQuery.data ?? [])].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    )[0];
    if (latestGap) {
      items.push({
        id: `gap-${latestGap.id}`,
        title: "Gap report ready",
        body: `${latestGap.weak_count} weak · ${latestGap.medium_count} medium · ${latestGap.strong_count} strong`,
        href: "/gaps",
        createdAt: latestGap.created_at,
        tone: "info",
      });
    }

    const activePlan = (plansQuery.data ?? []).find((p) => p.status === "active") ?? plansQuery.data?.[0];
    if (activePlan) {
      const done = (activePlan.tasks ?? []).filter((t) => t.completion_status === "completed").length;
      const total = activePlan.tasks?.length ?? 0;
      items.push({
        id: `plan-${activePlan.id}`,
        title: "Revision plan",
        body: `${done}/${total} tasks complete`,
        href: "/revision",
        createdAt: activePlan.updated_at ?? activePlan.created_at,
        tone: "success",
      });
    }

    const weak = dashboardQuery.data?.weak_topic_preview?.length ?? 0;
    if (weak > 0) {
      items.push({
        id: "weak-reminder",
        title: "Study reminder",
        body: `${weak} weak topic${weak === 1 ? "" : "s"} need attention.`,
        href: "/gaps",
        createdAt: null,
        tone: "warning",
      });
    }

    return items
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 8);
  }, [
    materialsQuery.data,
    quizzesQuery.data,
    gapsQuery.data,
    plansQuery.data,
    dashboardQuery.data,
  ]);

  return {
    notifications,
    count: notifications.length,
    loading:
      materialsQuery.isLoading ||
      quizzesQuery.isLoading ||
      gapsQuery.isLoading ||
      plansQuery.isLoading ||
      dashboardQuery.isLoading,
  };
}
