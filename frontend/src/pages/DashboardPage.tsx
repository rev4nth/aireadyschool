import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, ClipboardList, FileUp, Map } from "lucide-react";
import { useSubject } from "@/contexts/SubjectContext";
import { getDashboard } from "@/services/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn, getErrorMessage } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nextStep(data: {
  quizzes_completed?: number;
  weak_topic_count: number;
  not_assessed_topic_count?: number;
  weak_topic_preview?: string[];
  not_assessed_preview?: string[];
  upcoming_tasks: unknown[];
  recent_gap_summary?: string | null;
}) {
  if (!data.quizzes_completed) {
    return {
      label: "Take a diagnostic quiz",
      detail: "You haven’t assessed this subject yet. Start with a short quiz grounded in your materials.",
      to: "/quiz",
    };
  }
  if ((data.weak_topic_preview?.length ?? 0) > 0) {
    return {
      label: "Review weak topics",
      detail: `${data.weak_topic_preview![0]} needs improvement based on your answers.`,
      to: "/gaps",
    };
  }
  if ((data.not_assessed_preview?.length ?? 0) > 0) {
    return {
      label: "Assess remaining topics",
      detail: `You haven’t assessed ${data.not_assessed_preview![0]} yet.`,
      to: "/quiz",
    };
  }
  if (!data.upcoming_tasks.length) {
    return {
      label: "Create revision plan",
      detail: "Turn your diagnosis into a timed study schedule.",
      to: "/revision",
    };
  }
  return {
    label: "Continue revision",
    detail: "Work the next priority task in your plan.",
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
    return <DashboardSkeleton />;
  }

  if (!subjects.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Create your first subject"
        description="Add a subject, upload materials, then run a diagnostic quiz."
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

  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <DashboardSkeleton />;

  const subjectLabel = data.subject_name || currentSubject?.name || "Selected subject";
  const action = nextStep(data);
  const mastery = Math.round(data.overall_mastery);
  const hasAttempts = (data.quizzes_completed ?? 0) > 0;
  const dist = [
    { key: "Strong", value: data.gap_strong_count ?? data.strong_topic_count ?? 0, tone: "bg-success" },
    { key: "Medium", value: data.gap_medium_count ?? data.medium_topic_count ?? 0, tone: "bg-warning" },
    { key: "Weak", value: data.gap_weak_count ?? data.weak_topic_count ?? 0, tone: "bg-destructive" },
    {
      key: "Not assessed",
      value: data.gap_not_assessed_count ?? data.not_assessed_topic_count ?? 0,
      tone: "bg-muted-foreground/40",
    },
  ];
  const distTotal = dist.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {data.welcome_name?.split(" ")[0] || "learner"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let’s understand what you know in <span className="font-medium text-foreground">{subjectLabel}</span>{" "}
            and improve what you don’t.
          </p>
        </div>
        <Link
          to={action.to}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {!hasAttempts ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Get started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete these steps to unlock diagnosis. Unattempted topics stay “Not assessed” — never “Weak”.
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              { n: "1", t: "Add materials", d: "Upload syllabus & notes", to: "/materials" },
              { n: "2", t: "Generate topics", d: "Build your topic map", to: "/topics" },
              { n: "3", t: "Take a quiz", d: "Diagnose what you know", to: "/quiz" },
              { n: "4", t: "See your gaps", d: "Evidence-based diagnosis", to: "/gaps" },
            ].map((step) => (
              <Link
                key={step.n}
                to={step.to}
                className="rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted"
              >
                <p className="text-xs font-semibold text-primary">Step {step.n}</p>
                <p className="mt-1 text-sm font-medium">{step.t}</p>
                <p className="text-xs text-muted-foreground">{step.d}</p>
              </Link>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Overall mastery"
          value={hasAttempts ? `${mastery}%` : "—"}
          hint={hasAttempts ? "Based only on assessed topics" : "Available after your first quiz"}
        >
          {hasAttempts ? <Progress value={data.overall_mastery} className="mt-3 h-1.5" /> : null}
        </Metric>
        <Metric label="Knowledge gaps" value={String(data.weak_topic_count)}>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.medium_topic_count ?? 0} medium · {data.strong_topic_count ?? 0} strong ·{" "}
            {data.not_assessed_topic_count ?? 0} not assessed
          </p>
        </Metric>
        <Metric label="Diagnostic attempts" value={String(data.quizzes_completed ?? 0)}>
          <p className="mt-2 text-xs text-muted-foreground">Submitted quizzes for this subject</p>
        </Metric>
        <Metric label="Revision progress" value={`${Math.round(data.plan_completion_pct ?? 0)}%`}>
          <p className="mt-2 text-xs text-muted-foreground">Active plan completion</p>
        </Metric>
      </div>

      <div className="rounded-xl border border-primary/20 bg-accent/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your next best action</p>
        <p className="mt-1 text-sm text-foreground">{action.detail}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Knowledge overview</h2>
          <p className="mt-1 text-xs text-muted-foreground">Strong / Medium / Weak / Not assessed</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {dist.map((d) => (
              <div
                key={d.key}
                className={cn(d.tone)}
                style={{ width: `${(d.value / distTotal) * 100}%` }}
                title={`${d.key}: ${d.value}`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {dist.map((d) => (
              <div key={d.key} className="rounded-md bg-muted/50 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">{d.key}</p>
                <p className="text-lg font-semibold tabular-nums">{d.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Priority topics</h2>
              <p className="text-xs text-muted-foreground">Focus on demonstrated weaknesses first</p>
            </div>
            <Link to="/gaps" className="text-xs font-medium text-primary hover:underline">
              Full diagnosis
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(data.weak_topic_preview ?? []).length === 0 &&
            (data.not_assessed_preview ?? []).length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                No priority topics yet. Complete a quiz to unlock diagnosis.
              </p>
            ) : (
              <>
                {(data.weak_topic_preview ?? []).map((topic) => (
                  <div key={topic} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{topic}</p>
                      <p className="text-xs text-muted-foreground">Needs improvement based on quiz evidence</p>
                    </div>
                    <Badge variant="danger">Weak</Badge>
                  </div>
                ))}
                {(data.not_assessed_preview ?? []).slice(0, 3).map((topic) => (
                  <div key={topic} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{topic}</p>
                      <p className="text-xs text-muted-foreground">Not assessed yet</p>
                    </div>
                    <Badge variant="muted">Not assessed</Badge>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Revision queue</h2>
            <Link to="/revision" className="text-xs font-medium text-primary hover:underline">
              Open plan
            </Link>
          </div>
          {data.upcoming_tasks.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No active tasks for this subject.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.upcoming_tasks.slice(0, 5).map((task, index) => (
                <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 w-5 text-xs tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.duration_minutes ?? 30} min
                      {task.scheduled_day ? ` · Day ${task.scheduled_day}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Latest diagnosis</h2>
          {data.recent_gap_summary ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.recent_gap_summary}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No gap report yet for this subject.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/gaps" className="text-sm font-medium text-primary hover:underline">
              View knowledge gaps
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/quiz" className="text-sm font-medium text-primary hover:underline">
              Retake diagnostic
            </Link>
          </div>
        </section>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/materials" icon={FileUp} title="Materials" detail="Upload syllabus & notes" />
        <QuickLink to="/topics" icon={Map} title="Topic map" detail="Syllabus structure" />
        <QuickLink to="/quiz" icon={ClipboardList} title="Quiz" detail="Diagnose gaps" />
        <QuickLink to="/revision" icon={BookOpenCheck} title="Plan" detail="Study by priority" />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3" title={hint}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {children}
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
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/60"
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
