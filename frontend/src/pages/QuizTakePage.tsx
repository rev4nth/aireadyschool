import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getQuiz, startQuiz, submitQuiz } from "@/services/quizzes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";

export function QuizTakePage() {
  const { quizId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(
    (location.state as { attemptId?: string } | null)?.attemptId ?? null,
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Boolean(quizId),
  });

  useEffect(() => {
    if (!quizId || attemptId) return;
    startQuiz(quizId)
      .then((res) => setAttemptId(res.attempt_id))
      .catch((error) => toast.error(getErrorMessage(error)));
  }, [quizId, attemptId]);

  useEffect(() => {
    const limit = quizQuery.data?.time_limit_seconds;
    if (!limit) return;
    setSecondsLeft(limit);
  }, [quizQuery.data?.time_limit_seconds]);

  const questions = useMemo(
    () => [...(quizQuery.data?.questions ?? [])].sort((a, b) => a.question_index - b.question_index),
    [quizQuery.data?.questions],
  );
  const current = questions[index];
  const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error("Attempt not started");
      return submitQuiz(quizId, {
        attempt_id: attemptId,
        answers: questions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] ?? "",
        })),
      });
    },
    onSuccess: (result) => {
      toast.success("Quiz submitted");
      navigate(`/quiz/${quizId}/results`, { state: { result } });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  useEffect(() => {
    if (secondsLeft == null) return;
    if (secondsLeft <= 0) {
      submitMutation.mutate();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => window.clearTimeout(timer);
    // intentionally only depends on secondsLeft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (quizQuery.isLoading) return <Skeleton className="h-64" />;
  if (quizQuery.isError || !current) {
    return <ErrorState description={getErrorMessage(quizQuery.error)} onRetry={() => quizQuery.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={quizQuery.data?.title ?? "Quiz"}
        description={`Question ${index + 1} of ${questions.length}`}
        actions={
          secondsLeft != null ? (
            <span className="rounded-md bg-muted px-3 py-1 text-sm font-medium">
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          ) : null
        }
      />
      <Progress value={progress} />

      <Card>
        <CardContent className="space-y-4 py-6">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">{current.question_type}</p>
          <h2 className="font-display text-xl font-semibold">{current.question_text}</h2>

          {current.question_type === "mcq" && current.options ? (
            <div className="space-y-2">
              {current.options.map((option) => {
                const value = String(option);
                return (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name={current.id}
                      checked={answers[current.id] === value}
                      onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: value }))}
                    />
                    <span>{value}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <Textarea
              rows={5}
              placeholder="Type your answer…"
              value={answers[current.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Previous
        </Button>
        <div className="flex gap-2">
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
          ) : (
            <Button
              onClick={() => {
                if (!window.confirm("Submit your answers? You cannot change them after submission.")) return;
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit quiz"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
