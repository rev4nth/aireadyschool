import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { generateQuiz, listQuizzes, startQuiz } from "@/services/quizzes";
import { listTopics } from "@/services/topics";
import type { Difficulty, QuizMode, Topic } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";

function flattenTopics(topics: Topic[]): Array<{ id: string; name: string }> {
  return topics.flatMap((t) => [
    { id: t.id, name: t.name },
    ...flattenTopics(t.children ?? []),
  ]);
}

export function QuizPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentSubjectId } = useSubject();
  const [mode, setMode] = useState<QuizMode>("weak_topics");
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [count, setCount] = useState(8);
  const [topicId, setTopicId] = useState("");
  const [timer, setTimer] = useState(false);
  const [title, setTitle] = useState("Diagnostic quiz");

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", currentSubjectId],
    queryFn: () => listQuizzes(currentSubjectId),
    enabled: Boolean(currentSubjectId),
  });

  const topicsQuery = useQuery({
    queryKey: ["topics", currentSubjectId],
    queryFn: () => listTopics(currentSubjectId!),
    enabled: Boolean(currentSubjectId),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateQuiz({
        subject_id: currentSubjectId!,
        title,
        quiz_mode: mode,
        topic_ids: mode === "topic" && topicId ? [topicId] : [],
        difficulty,
        question_count: count,
        time_limit_seconds: timer ? count * 90 : null,
      }),
    onSuccess: async (quiz) => {
      toast.success("Quiz generated from your materials");
      await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      const started = await startQuiz(quiz.id);
      navigate(`/quiz/${quiz.id}/take`, { state: { attemptId: started.attempt_id } });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!currentSubjectId) {
    return (
      <>
        <PageHeader title="Diagnostic Quiz" description="Generate grounded quizzes from your uploads." />
        <EmptyState
          icon={ClipboardList}
          title="Select a subject"
          description="Choose a subject in the header to generate a diagnostic quiz."
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostic Quiz"
        description="Questions are generated only from your retrieved study materials."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as QuizMode)}>
              <option value="subject">By subject</option>
              <option value="topic">By topic</option>
              <option value="weak_topics">Across weak topics</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="mixed">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          {mode === "topic" ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topic">Topic</Label>
              <Select id="topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">Select topic</option>
                {flattenTopics(topicsQuery.data?.topics ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="count">Question count</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={40}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} />
              Enable timer
            </label>
          </div>
          <div className="md:col-span-2">
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || (mode === "topic" && !topicId)}
            >
              {generateMutation.isPending ? "Generating…" : "Generate & start"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent quizzes</h2>
        {quizzesQuery.isLoading ? <Skeleton className="h-24" /> : null}
        {quizzesQuery.isError ? (
          <ErrorState
            message={getErrorMessage(quizzesQuery.error)}
            onRetry={() => {
              void quizzesQuery.refetch();
            }}
          />
        ) : null}
        {!quizzesQuery.isLoading && !quizzesQuery.data?.length ? (
          <EmptyState
            icon={ClipboardList}
            title="No quizzes yet"
            description="Generate your first diagnostic quiz from processed materials."
          />
        ) : null}
        <div className="grid gap-3">
          {quizzesQuery.data?.map((quiz) => (
            <Card key={quiz.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {quiz.question_count} questions · {quiz.difficulty} · {quiz.quiz_mode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{quiz.status}</Badge>
                  {quiz.status === "submitted" ? (
                    <Link
                      to={`/quiz/${quiz.id}/results`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Results
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void (async () => {
                          try {
                            const started = await startQuiz(quiz.id);
                            navigate(`/quiz/${quiz.id}/take`, {
                              state: { attemptId: started.attempt_id },
                            });
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        })();
                      }}
                    >
                      <Play className="h-4 w-4" />
                      Take
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
