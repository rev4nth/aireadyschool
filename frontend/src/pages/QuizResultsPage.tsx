import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getQuiz } from "@/services/quizzes";
import type { Citation, QuizQuestion, QuizResult, QuizResultEvaluation } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function resultStorageKey(quizId: string) {
  return `gapfinder:quiz-result:${quizId}`;
}

function formatCitation(c: Citation): string {
  const parts = [
    c.document_title ?? "Uploaded material",
    c.section_heading ? `§ ${c.section_heading}` : null,
    c.page_number != null ? `p.${c.page_number}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function QuizResultsPage() {
  const { quizId = "" } = useParams();
  const location = useLocation();
  const stateResult = (location.state as { result?: QuizResult } | null)?.result;
  const [storedResult, setStoredResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    if (!quizId) return;
    if (stateResult) {
      try {
        sessionStorage.setItem(resultStorageKey(quizId), JSON.stringify(stateResult));
      } catch {
        /* ignore quota */
      }
      setStoredResult(stateResult);
      return;
    }
    try {
      const raw = sessionStorage.getItem(resultStorageKey(quizId));
      setStoredResult(raw ? (JSON.parse(raw) as QuizResult) : null);
    } catch {
      setStoredResult(null);
    }
  }, [quizId, stateResult]);

  const result = stateResult ?? storedResult;

  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Boolean(quizId) && !result,
  });

  if (!result && quizQuery.isLoading) return <Skeleton className="h-48" />;

  const score = typeof result?.score === "number" ? result.score : null;
  const maxScore = typeof result?.max_score === "number" ? result.max_score : null;
  const percentage =
    typeof result?.percentage === "number"
      ? result.percentage
      : score != null && maxScore
        ? (score / maxScore) * 100
        : null;

  const evaluations: QuizResultEvaluation[] =
    result?.evaluations ??
    (result?.answers ?? []).map((answer) => ({
      question_id: answer.question_id,
      score: answer.score,
      classification: answer.classification,
      is_correct: answer.is_correct,
      evaluation: answer.evaluation,
    }));

  const questions: QuizQuestion[] = result?.questions ?? quizQuery.data?.questions ?? [];

  const questionById = useMemo(() => {
    const map = new Map<string, QuizQuestion>();
    for (const q of questions) map.set(q.id, q);
    return map;
  }, [questions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz results"
        description="Answers are revealed only after submission. Gap report and revision plan refresh automatically."
        actions={
          <div className="flex gap-2">
            <Link
              to="/gaps"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              View gap report
            </Link>
            <Link
              to="/revision"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Revision plan
            </Link>
            <Link
              to="/quiz"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to quizzes
            </Link>
          </div>
        }
      />

      {result ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Score:{" "}
                {percentage != null
                  ? `${percentage.toFixed(1)}%`
                  : "—"}
                {score != null && maxScore != null ? ` (${score}/${maxScore})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {percentage != null ? <Progress value={percentage} /> : null}
              {result.gap_report_id ? (
                <p className="text-sm text-muted-foreground">
                  Diagnosis updated. Gap report and any active revision plan were refreshed from this attempt.
                </p>
              ) : null}
              {Object.entries(result.topic_performance || {}).map(([id, perf]) => {
                const row = asRecord(perf);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span>{(row?.topic as string | undefined) ?? id}</span>
                    <Badge>{(row?.classification as string | undefined) ?? "n/a"}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {evaluations.map((ev) => {
              const question = questionById.get(ev.question_id);
              const evaluation = asRecord(ev.evaluation) ?? {};
              const explanation =
                (evaluation.feedback as string | undefined) ||
                (evaluation.explanation as string | undefined) ||
                ((ev as { explanation?: string }).explanation ?? null);
              const corrected =
                (evaluation.corrected_answer as string | undefined) ||
                ((ev as { corrected_answer?: string }).corrected_answer ?? null);
              const citations = (
                ((evaluation.citations as Citation[] | undefined) ||
                  ((ev as { citations?: Citation[] }).citations ?? []) ||
                  question?.citations ||
                  []) as Citation[]
              ).filter(Boolean);

              return (
                <Card key={ev.question_id}>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {question?.question_text || `Question ${ev.question_id.slice(0, 8)}`}
                      </p>
                      <Badge
                        variant={
                          ev.classification === "correct"
                            ? "success"
                            : ev.classification === "partially_correct"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {ev.classification || "reviewed"}
                        {ev.score != null ? ` · ${ev.score}` : ""}
                      </Badge>
                    </div>
                    {explanation ? (
                      <p className="text-sm text-muted-foreground">{explanation}</p>
                    ) : null}
                    {corrected ? (
                      <p className="text-sm">
                        <span className="font-medium">Corrected: </span>
                        {corrected}
                      </p>
                    ) : null}
                    {citations.length > 0 ? (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Sources</p>
                        {citations.map((c, idx) => (
                          <div key={`${c.chunk_id ?? idx}`}>
                            <p>{formatCitation(c)}</p>
                            {c.excerpt ? (
                              <p className="mt-0.5 line-clamp-2 italic opacity-90">“{c.excerpt}”</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="space-y-3 py-6 text-sm text-muted-foreground">
            <p>
              No saved result for this quiz in this browser session. Complete a quiz to see scored
              answers with citations, or open Gap Report after an attempt.
            </p>
            {quizQuery.data ? <p>Quiz: {quizQuery.data.title}</p> : null}
            <Link
              to={`/quiz/${quizId}/take`}
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retake quiz
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
