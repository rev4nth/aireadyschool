import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartColumnIncreasing } from "lucide-react";
import { useSubject } from "@/contexts/SubjectContext";
import { getAnalytics } from "@/services/analytics";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";

export function AnalyticsPage() {
  const { currentSubjectId } = useSubject();
  const analyticsQuery = useQuery({
    queryKey: ["analytics", currentSubjectId],
    queryFn: () => getAnalytics(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  if (!currentSubjectId) {
    return (
      <>
        <PageHeader title="Progress Analytics" description="Charts from your persisted performance." />
        <EmptyState
          icon={ChartColumnIncreasing}
          title="Select a subject"
          description="Analytics are computed from real quiz and mastery records."
        />
      </>
    );
  }

  if (analyticsQuery.isLoading) return <Skeleton className="h-64" />;
  if (analyticsQuery.isError) {
    return (
      <ErrorState description={getErrorMessage(analyticsQuery.error)} onRetry={() => analyticsQuery.refetch()} />
    );
  }

  const data = analyticsQuery.data!;
  const overview = data.overview;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your learning analytics"
        description="Progress from real quiz attempts only. Trends need at least two attempts."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Overall mastery</p>
            <p className="text-2xl font-semibold">{overview.overall_mastery.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Assessed topics only</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">W / M / S / NA</p>
            <p className="text-2xl font-semibold">
              {overview.weak_topics}/{overview.medium_topics}/{overview.strong_topics}/
              {overview.not_assessed_topics ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Improvement</p>
            <p className="text-2xl font-semibold">{overview.improvement_pct.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(data.quiz_performance_over_time?.length ?? 0) < 2
                ? "Need another quiz for a trend"
                : "Recent vs historical average"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Plan completion</p>
            <p className="text-2xl font-semibold">{overview.plan_completion_pct.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic mastery distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.mastery_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="mastery" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz performance over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(data.quiz_performance_over_time?.length ?? 0) === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No quiz attempts yet. Complete a diagnostic to plot scores.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.quiz_performance_over_time}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score_pct" stroke="#087F70" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {data.topic_progress_lines?.[0] && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Topic progress: {data.topic_progress_lines[0].topic}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.topic_progress_lines[0].points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="attempt" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#115e59" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most improved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.most_improved_topics.map((t) => (
              <div key={t.topic} className="flex justify-between">
                <span>{t.topic}</span>
                <span>+{t.delta}</span>
              </div>
            ))}
            {!data.most_improved_topics.length && (
              <p className="text-muted-foreground">Complete more attempts to see improvement.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persistent weak topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.persistent_weak_topics.map((t) => (
              <div key={t.topic} className="flex justify-between">
                <span>{t.topic}</span>
                <span>{t.mastery}% · {t.attempts} attempts</span>
              </div>
            ))}
            {!data.persistent_weak_topics.length && (
              <p className="text-muted-foreground">No persistent weak topics yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
