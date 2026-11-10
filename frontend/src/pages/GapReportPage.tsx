import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { generateGapReport, listGapReports } from "@/services/gapReports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";
import type { GapTopicItem } from "@/types";

function topicReason(topic: GapTopicItem): string {
  if (topic.reason?.trim()) return topic.reason;
  const attempted = topic.questions_attempted ?? 0;
  const incorrect = topic.incorrect_count ?? 0;
  if (attempted > 0) {
    return `You got ${incorrect} of ${attempted} questions on ${topic.topic_name || "this topic"} wrong.`;
  }
  return `No quiz answers yet for ${topic.topic_name || "this topic"} — marked weak until you attempt questions.`;
}

export function GapReportPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["gap-reports", currentSubjectId],
    queryFn: () => listGapReports(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateGapReport({ subject_id: currentSubjectId! }),
    onSuccess: async () => {
      toast.success("Gap report generated from your quiz evidence");
      await queryClient.invalidateQueries({ queryKey: ["gap-reports"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const latest = reportsQuery.data?.[0];
  const topics = (latest?.topics ?? []) as GapTopicItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gap report"
        description="Weak, medium, and strong topics from your quiz answers."
        actions={
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!currentSubjectId || generateMutation.isPending}
          >
            {generateMutation.isPending ? "Analyzing…" : "Generate report"}
          </Button>
        }
      />

      {!currentSubjectId && (
        <EmptyState icon={Brain} title="Select a subject" description="Gap analysis is scoped to one subject." />
      )}

      {reportsQuery.isLoading && <Skeleton className="h-40" />}
      {reportsQuery.isError && (
        <ErrorState description={getErrorMessage(reportsQuery.error)} onRetry={() => reportsQuery.refetch()} />
      )}

      {latest ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall mastery {latest.overall_mastery?.toFixed(1) ?? 0}%</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{latest.summary}</p>
              <p>
                Weak {latest.weak_count} · Medium {latest.medium_count} · Strong {latest.strong_count}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {topics.map((topic, idx) => (
              <Card key={String(topic.topic_id ?? idx)}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {topic.topic_name || "Untitled topic"}
                    </h3>
                    <Badge>
                      {topic.classification} · {Number(topic.mastery_score ?? 0).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{topicReason(topic)}</p>
                  {topic.recommended_focus ? (
                    <p className="text-sm">{topic.recommended_focus}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        !reportsQuery.isLoading &&
        currentSubjectId && (
          <EmptyState
            icon={Brain}
            title="No gap reports yet"
            description="Complete a diagnostic quiz, then generate your first diagnosis."
          />
        )
      )}
    </div>
  );
}
