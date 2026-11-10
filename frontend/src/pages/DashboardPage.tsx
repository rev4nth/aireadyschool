import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  FileUp,
  Map,
} from "lucide-react";
import { useSubject } from "@/contexts/SubjectContext";
import { getDashboard } from "@/services/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn, getErrorMessage } from "@/lib/utils";

function nextStep(data: {
  quizzes_completed?: number;
  weak_topic_count: number;
  upcoming_tasks: unknown[];
  recent_gap_summary?: string | null;
}) {
  if (!data.quizzes_completed) {
    return {
      label: "Take diagnostic quiz",
      detail: "Test yourself on this subject’s uploaded material.",
      to: "/quiz",
    };
  }
  if (!data.recent_gap_summary) {
    return {
      label: "View gap report",
      detail: "See which topics are weak, medium, and strong.",
      to: "/gaps",
    };
  }
  if (!data.upcoming_tasks.length) {
    return {
      label: "Create revision plan",
      detail: "Turn weak topics into a timed study plan.",
      to: "/revision",
    };
  }
  return {
    label: "Continue revision",
    detail: `${data.weak_topic_count} weak topic${data.weak_topic_count === 1 ? "" : "s"} still need work.`,
    to: "/revision",
  };
}

export function DashboardPage() {
  const { currentSubjectId, currentSubject, subjects, isLoading: subjectsLoading } = useSubject();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", currentSubjectId],
    queryFn: () => getDashboard(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  if (subjectsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  if (!subjects.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Add a subject to begin"
        description="Create a subject, upload materials, then run a diagnostic quiz."
        action={
          <Link
            to="/settings"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Open settings
          </Link>
        }
      />
    );
  }

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  const subjectLabel = data.subject_name || currentSubject?.name || "Selected subject";
  const action = nextStep(data);
  const mastery = Math.round(data.overall_mastery);
  const weakPreview = data.weak_topic_preview ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{subjectLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload → Quiz → Gaps → Plan. Everything below is for this subject only.
          </p>
        </div>
        <Link
          to={action.to}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Mastery" value={`${mastery}%`}>
          <Progress value={data.overall_mastery} className="mt-3 h-1.5" />
        </Metric>
        <Metric label="Weak topics" value={String(data.weak_topic_count)}>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.medium_topic_count ?? 0} medium · {data.strong_topic_count ?? 0} strong
          </p>
        </Metric>
        <Metric label="Quizzes" value={String(data.quizzes_completed ?? 0)}>
          <p className="mt-2 text-xs text-muted-foreground">Completed for this subject</p>
        </Metric>
        <Metric label="Plan done" value={`${Math.round(data.plan_completion_pct ?? 0)}%`}>
          <p className="mt-2 text-xs text-muted-foreground">Active revision progress</p>
        </Metric>
      </div>

      <div className="rounded-lg border border-border bg-accent/50 px-3.5 py-2.5 text-sm">
        <span className="font-medium text-foreground">Next step: </span>
        <span className="text-muted-foreground">{action.detail}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-lg border border-border bg-card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Revision queue</h2>
              <p className="text-xs text-muted-foreground">Highest priority first</p>
            </div>
            <Link to="/revision" className="text-xs font-medium text-primary hover:underline">
              Open plan
            </Link>
          </div>
          {data.upcoming_tasks.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              No tasks yet.{" "}
              <Link to="/revision" className="font-medium text-primary hover:underline">
                Create a revision plan
              </Link>
              .
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.upcoming_tasks.map((task, index) => (
                <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 w-5 text-xs tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.duration_minutes ?? 30} min
                      {task.activity ? ` · ${task.activity}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">P{task.priority ?? "—"}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Diagnosis</h2>
              <p className="text-xs text-muted-foreground">Latest gap report</p>
            </div>
            <Link to="/gaps" className="text-xs font-medium text-primary hover:underline">
              Full report
            </Link>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2">
              <StatusStat label="Weak" value={data.gap_weak_count ?? data.weak_topic_count} tone="danger" />
              <StatusStat
                label="Medium"
                value={data.gap_medium_count ?? data.medium_topic_count ?? 0}
                tone="warning"
              />
              <StatusStat
                label="Strong"
                value={data.gap_strong_count ?? data.strong_topic_count ?? 0}
                tone="success"
              />
            </div>

            {data.recent_gap_summary ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{data.recent_gap_summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No gap report yet. Take a quiz first.
              </p>
            )}

            {weakPreview.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Focus first</p>
                <ul className="space-y-1.5">
                  {weakPreview.map((topic) => (
                    <li key={topic} className="rounded-md bg-muted px-2.5 py-1.5 text-sm">
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/materials" icon={FileUp} title="Materials" detail="Upload syllabus & notes" />
        <QuickLink to="/topics" icon={Map} title="Topics" detail="Syllabus map" />
        <QuickLink to="/quiz" icon={ClipboardList} title="Quiz" detail="Diagnose gaps" />
        <QuickLink to="/revision" icon={BookOpenCheck} title="Plan" detail="Revise by priority" />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {children}
    </div>
  );
}

function StatusStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-2 text-center",
        tone === "danger" && "border-destructive/20 bg-destructive/5",
        tone === "warning" && "border-warning/20 bg-warning/5",
        tone === "success" && "border-success/20 bg-success/5",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: typeof FileUp;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/60"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}
