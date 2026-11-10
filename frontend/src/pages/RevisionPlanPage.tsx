import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { listGapReports } from "@/services/gapReports";
import {
  createRevisionPlan,
  listRevisionPlans,
  recalculateRevisionPlan,
  updateRevisionTask,
} from "@/services/revisionPlans";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";

export function RevisionPlanPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  const [hours, setHours] = useState(2);
  const [examDate, setExamDate] = useState("");

  const plansQuery = useQuery({
    queryKey: ["revision-plans", currentSubjectId],
    queryFn: () => listRevisionPlans(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  const gapQuery = useQuery({
    queryKey: ["gap-reports", currentSubjectId],
    queryFn: () => listGapReports(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  const latestGapId = gapQuery.data?.[0]?.id ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      createRevisionPlan({
        subject_id: currentSubjectId!,
        gap_report_id: latestGapId,
        available_days: days,
        hours_per_day: hours,
        exam_date: examDate || null,
      }),
    onSuccess: async () => {
      toast.success(
        latestGapId
          ? "Revision plan created from your latest gap report"
          : "Revision plan created from current mastery",
      );
      await queryClient.invalidateQueries({ queryKey: ["revision-plans"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const latest = plansQuery.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revision plan"
        description="Ordered by weakness, exam importance, and past-paper frequency. Updates after each quiz."
      />

      {!currentSubjectId && (
        <EmptyState
          icon={BookOpenCheck}
          title="Select a subject"
          description="Plans are generated from that subject's gap diagnosis."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="plan-days">Available days</Label>
              <Input
                id="plan-days"
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-hours">Hours / day</Label>
              <Input
                id="plan-hours"
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-exam">Exam date</Label>
              <Input
                id="plan-exam"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
            <Button
              className="h-10 w-full md:w-auto"
              onClick={() => createMutation.mutate()}
              disabled={!currentSubjectId || createMutation.isPending}
            >
              {createMutation.isPending ? "Building…" : "Create plan"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {latestGapId
              ? "Using latest gap report for this subject."
              : "No gap report yet — will use mastery scores."}
          </p>
        </CardContent>
      </Card>

      {plansQuery.isLoading && <Skeleton className="h-40" />}
      {plansQuery.isError && (
        <ErrorState description={getErrorMessage(plansQuery.error)} onRetry={() => plansQuery.refetch()} />
      )}

      {latest ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{latest.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{latest.change_reason}</p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await recalculateRevisionPlan(latest.id);
                  toast.success("Plan recalculated");
                  await queryClient.invalidateQueries({ queryKey: ["revision-plans"] });
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }}
            >
              Recalculate
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(
              (latest.tasks ?? []).reduce<Record<string, typeof latest.tasks>>((acc, task) => {
                const day = String(task.scheduled_day ?? "Later");
                acc[day] = [...(acc[day] ?? []), task];
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => {
                if (a === "Later") return 1;
                if (b === "Later") return -1;
                return Number(a) - Number(b);
              })
              .map(([day, tasks]) => (
                <div key={day} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {day === "Later" ? "Unscheduled" : `Day ${day}`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {(tasks ?? []).reduce((sum, t) => sum + (t.duration_minutes || 0), 0)} min
                    </p>
                  </div>
                  {(tasks ?? [])
                    .slice()
                    .sort((a, b) => b.priority - a.priority)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.activity}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{task.prioritization_reason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">P{Math.round(task.priority)}</Badge>
                          <Badge>{task.duration_minutes}m</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={task.completion_status === "completed"}
                            onClick={async () => {
                              try {
                                await updateRevisionTask(latest.id, task.id, {
                                  completion_status: "completed",
                                });
                                toast.success("Task completed");
                                await queryClient.invalidateQueries({ queryKey: ["revision-plans"] });
                              } catch (error) {
                                toast.error(getErrorMessage(error));
                              }
                            }}
                          >
                            {task.completion_status === "completed" ? "Done" : "Complete"}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </CardContent>
        </Card>
      ) : (
        !plansQuery.isLoading &&
        currentSubjectId && (
          <EmptyState
            icon={BookOpenCheck}
            title="No revision plan yet"
            description="Generate a plan after you have topic mastery from quizzes."
          />
        )
      )}
    </div>
  );
}
