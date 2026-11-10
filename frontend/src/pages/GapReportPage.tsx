import { useMemo, useState } from "react";
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
import { masteryBadgeVariant, masteryLabel, normalizeMastery } from "@/lib/mastery";
import type { GapTopicItem, MasteryClass } from "@/types";

type Filter = "all" | MasteryClass;

export function GapReportPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

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
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const latest = reportsQuery.data?.[0];
  const topics = useMemo(() => {
    const rows = ((latest?.topics ?? []) as GapTopicItem[]).map((t) => ({
      ...t,
      classification: normalizeMastery(t.classification, t.questions_attempted),
    }));
    if (filter === "all") return rows;
    return rows.filter((t) => t.classification === filter);
  }, [latest?.topics, filter]);

  const counts = useMemo(() => {
    const rows = ((latest?.topics ?? []) as GapTopicItem[]).map((t) =>
      normalizeMastery(t.classification, t.questions_attempted),
    );
    return {
      weak: rows.filter((c) => c === "weak").length,
      medium: rows.filter((c) => c === "medium").length,
      strong: rows.filter((c) => c === "strong").length,
      not_assessed: rows.filter((c) => c === "not_assessed").length,
    };
  }, [latest?.topics]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your knowledge gaps"
        description="Evidence-based diagnosis from quiz answers. Unattempted topics are Not assessed — never Weak."
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
          {counts.weak + counts.medium + counts.strong === 0 ? (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="space-y-2 py-4 text-sm">
                <p className="font-medium text-foreground">No assessed topics yet</p>
                <p className="text-muted-foreground">
                  Knowledge Gaps only classifies topics that appear on graded quiz questions.
                  Your topic map may need a clean regenerate from the syllabus, then take a new
                  diagnostic quiz. Unattempted topics stay <span className="font-medium">Not assessed</span>
                  — they are not Weak.
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Topic Map → Generate from materials</li>
                  <li>Diagnostic Quiz → Generate & start → submit answers</li>
                  <li>Return here and click Generate report</li>
                </ol>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>
                Overall mastery {latest.overall_mastery?.toFixed(1) ?? 0}%
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{latest.summary}</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {(
                  [
                    ["Weak", counts.weak, "danger"],
                    ["Medium", counts.medium, "warning"],
                    ["Strong", counts.strong, "success"],
                    ["Not assessed", counts.not_assessed, "muted"],
                  ] as const
                ).map(([label, value, variant]) => (
                  <div key={label} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs">{label}</p>
                    <p className="text-lg font-semibold text-foreground">{value}</p>
                    <Badge variant={variant} className="mt-1">
                      {label}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["weak", "Weak"],
                ["medium", "Medium"],
                ["strong", "Strong"],
                ["not_assessed", "Not assessed"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3">
            {topics.map((topic, idx) => (
              <Card key={String(topic.topic_id ?? idx)}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{topic.topic_name || "Untitled topic"}</h3>
                    <Badge variant={masteryBadgeVariant(topic.classification)}>
                      {masteryLabel(topic.classification)}
                      {topic.classification !== "not_assessed"
                        ? ` · ${Number(topic.mastery_score ?? 0).toFixed(0)}%`
                        : ""}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {topic.reason ||
                      (topic.classification === "not_assessed"
                        ? "Not assessed — take a quiz to establish your mastery."
                        : "No reason available.")}
                  </p>
                  {topic.classification !== "not_assessed" ? (
                    <p className="text-xs text-muted-foreground">
                      Attempted {topic.questions_attempted ?? 0} · Correct {topic.correct_count ?? 0} ·
                      Incorrect {topic.incorrect_count ?? 0}
                    </p>
                  ) : null}
                  {topic.recommended_focus ? (
                    <p className="text-sm">
                      <span className="font-medium">Next: </span>
                      {topic.recommended_focus}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {!topics.length ? (
              <p className="text-sm text-muted-foreground">No topics match this filter.</p>
            ) : null}
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
