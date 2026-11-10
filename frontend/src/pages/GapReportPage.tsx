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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gap Report"
        description="Diagnose what you don't know — based on actual answers, not guesses."
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
            {(latest.topics as Array<Record<string, unknown>>).map((topic, idx) => (
              <Card key={String(topic.topic_id ?? idx)}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold">{String(topic.topic)}</h3>
                    <Badge>{String(topic.classification)} · {String(topic.mastery_score)}%</Badge>
                  </div>
                  {!!(topic.difficulty_areas as string[] | undefined)?.length && (
                    <p className="text-sm">
                      Difficulty areas: {(topic.difficulty_areas as string[]).join(", ")}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{String(topic.recommended_action)}</p>
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
