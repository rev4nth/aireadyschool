import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, Flame, Target } from "lucide-react";
import { useSubject } from "@/contexts/SubjectContext";
import { getDashboard } from "@/services/progress";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";

export function DashboardPage() {
  const { currentSubjectId, subjects, isLoading: subjectsLoading } = useSubject();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", currentSubjectId],
    queryFn: () => getDashboard(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  if (subjectsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (!subjects.length) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your study command center." />
        <EmptyState
          icon={Target}
          title="Create your first subject"
          description="Add a subject to start uploading materials and tracking mastery."
          action={
            <Link
              to="/settings"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Settings
            </Link>
          }
        />
      </>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Hello, ${data.welcome_name || "learner"}`}
        description="Pick up where you left off and close the next knowledge gap."
        actions={
          <Link
            to="/quiz"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start diagnostic <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Overall mastery</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Target className="h-5 w-5 text-primary" />
              {Math.round(data.overall_mastery)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={data.overall_mastery} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Study streak</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Flame className="h-5 w-5 text-warning" />
              {data.study_streak}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Keep the chain going with a short session today.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Weak topics</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Brain className="h-5 w-5 text-destructive" />
              {data.weak_topic_count}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/gaps" className="text-sm text-primary hover:underline">
              View gap report
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming revision</CardTitle>
            <CardDescription>Highest-priority tasks from your active plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcoming_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming tasks yet. Generate a revision plan.</p>
            ) : (
              data.upcoming_tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.duration_minutes ?? 30} min · {task.status || "pending"}
                    </p>
                  </div>
                  <Link to="/revision" className="text-xs text-primary hover:underline">
                    Open
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest gap summary</CardTitle>
            <CardDescription>Insights from your most recent diagnostic.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent_gap_summary ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{data.recent_gap_summary}</p>
            ) : (
              <EmptyState
                className="border-0 bg-transparent py-6"
                title="No gap report yet"
                description="Complete a quiz to generate your first knowledge gap analysis."
                action={
                  <Link to="/quiz" className="text-sm text-primary hover:underline">
                    Take a quiz
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
