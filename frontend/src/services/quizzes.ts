import { api } from "@/lib/api";
import type {
  AnswerSubmission,
  Difficulty,
  QuestionType,
  Quiz,
  QuizMode,
  QuizResult,
  QuizStartResponse,
} from "@/types";

export async function listQuizzes(subjectId?: string | null) {
  const { data } = await api.get<Quiz[]>("/quizzes", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return data;
}

export async function generateQuiz(payload: {
  subject_id: string;
  title?: string;
  quiz_mode?: QuizMode;
  topic_id?: string;
  topic_ids?: string[];
  difficulty?: Difficulty;
  question_count?: number;
  question_types?: QuestionType[];
  include_types?: QuestionType[];
  time_limit_seconds?: number | null;
}) {
  const body = {
    subject_id: payload.subject_id,
    title: payload.title,
    quiz_mode: payload.quiz_mode,
    topic_ids:
      payload.topic_ids ??
      (payload.topic_id ? [payload.topic_id] : []),
    difficulty: payload.difficulty,
    question_count: payload.question_count,
    question_types: payload.question_types ?? payload.include_types,
    time_limit_seconds: payload.time_limit_seconds,
  };
  const { data } = await api.post<Quiz>("/quizzes/generate", body);
  return data;
}

export async function getQuiz(quizId: string) {
  const { data } = await api.get<Quiz>(`/quizzes/${quizId}`);
  return data;
}

export async function startQuiz(quizId: string) {
  const { data } = await api.post<QuizStartResponse>(`/quizzes/${quizId}/start`);
  return data;
}

export async function submitQuiz(
  quizId: string,
  payload: { attempt_id: string; answers: AnswerSubmission[] },
) {
  const { data } = await api.post<QuizResult>(`/quizzes/${quizId}/submit`, payload);
  return data;
}
