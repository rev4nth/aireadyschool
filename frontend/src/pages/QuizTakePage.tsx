import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bookmark, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { getQuiz, startQuiz, submitQuiz } from "@/services/quizzes";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, getErrorMessage } from "@/lib/utils";

export function QuizTakePage() {
  const { quizId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(
    (location.state as { attemptId?: string } | null)?.attemptId ?? null,
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const unanswered = questions.length - answeredCount;

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
      try {
        sessionStorage.setItem(`gapfinder:quiz-result:${quizId}`, JSON.stringify(result));
      } catch {
        /* ignore quota */
      }
      toast.success(
        result.gap_report_id
          ? "Submitted — gap report and revision plan refreshed"
          : "Quiz submitted",
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const toggleMark = (id: string) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (quizQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (quizQuery.isError || !current) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState description={getErrorMessage(quizQuery.error)} onRetry={() => quizQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{quizQuery.data?.title ?? "Diagnostic quiz"}</p>
            <p className="text-xs text-muted-foreground">
              Question {index + 1} of {questions.length} · {answeredCount} answered
            </p>
          </div>
          {secondsLeft != null ? (
            <span className="rounded-md bg-muted px-3 py-1 text-sm font-medium tabular-nums">
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          ) : null}
          <Link
            to="/quiz"
            aria-label="Exit quiz"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>{current.question_type}</span>
              {current.difficulty ? <span>· {current.difficulty}</span> : null}
            </div>
            <h2 className="text-xl font-semibold leading-snug text-foreground">{current.question_text}</h2>

            <div className="mt-5 space-y-2">
              {current.question_type === "mcq" && current.options ? (
                current.options.map((option) => {
                  const value = String(option);
                  const selected = answers[current.id] === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition",
                        selected
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      <input
                        type="radio"
                        className="accent-[var(--primary)]"
                        name={current.id}
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: value }))}
                      />
                      <span className="text-sm">{value}</span>
                    </label>
                  );
                })
              ) : (
                <Textarea
                  rows={6}
                  placeholder="Type your answer…"
                  value={answers[current.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
            <Button
              variant={marked.has(current.id) ? "secondary" : "outline"}
              onClick={() => toggleMark(current.id)}
            >
              <Flag className="h-4 w-4" />
              {marked.has(current.id) ? "Marked" : "Mark for review"}
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={submitMutation.isPending}>
                Submit quiz
              </Button>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium">Question navigator</p>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const answered = Boolean((answers[q.id] ?? "").trim());
              const isMarked = marked.has(q.id);
              const active = i === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition",
                    active && "border-primary bg-accent text-accent-foreground",
                    !active && answered && "border-success/40 bg-success/10 text-foreground",
                    !active && !answered && "border-border bg-muted/40 text-muted-foreground",
                  )}
                  aria-label={`Question ${i + 1}${answered ? ", answered" : ", unanswered"}${isMarked ? ", marked" : ""}`}
                >
                  {i + 1}
                  {isMarked ? (
                    <Bookmark className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            <li>Filled = answered</li>
            <li>Bookmark = marked for review</li>
            <li>
              {answeredCount}/{questions.length} answered · {marked.size} marked
            </li>
          </ul>
          <Button className="mt-4 w-full" onClick={() => setConfirmOpen(true)} disabled={submitMutation.isPending}>
            Review & submit
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this quiz?"
        description={
          unanswered > 0
            ? `You have answered ${answeredCount} of ${questions.length}. ${unanswered} unanswered. Submit anyway?`
            : `You answered all ${questions.length} questions. You can’t change answers after submission.`
        }
        confirmLabel={submitMutation.isPending ? "Submitting…" : "Submit quiz"}
        loading={submitMutation.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          submitMutation.mutate();
        }}
      />
    </div>
  );
}
