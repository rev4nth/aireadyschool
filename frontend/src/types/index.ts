export type DocType = "syllabus" | "textbook" | "notes" | "past_paper" | "text";
export type DocStatus = "pending" | "processing" | "processed" | "failed";
export type MasteryClass = "weak" | "medium" | "strong";
export type QuizMode = "subject" | "topic" | "weak_topics" | "custom";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type QuestionType = "mcq" | "short_answer" | "conceptual" | "application";
export type AnswerClassification = "correct" | "partially_correct" | "incorrect";
export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type PlanStatus = "active" | "completed" | "archived";

export interface Citation {
  chunk_id: string;
  document_title?: string | null;
  page_number?: number | null;
  section_heading?: string | null;
  excerpt?: string | null;
  score?: number | null;
}

export interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  study_streak: number;
  last_study_date?: string | null;
  preferences: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  exam_date?: string | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Material {
  id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  doc_type: DocType | string;
  file_name?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  status: DocStatus | string;
  error_message?: string | null;
  page_count?: number | null;
  material_version: number;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MaterialListResponse {
  items: Material[];
  total: number;
}

export interface ProcessStatus {
  id: string;
  status: DocStatus | string;
  error_message?: string | null;
  page_count?: number | null;
  chunk_count?: number;
}

export interface Topic {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id?: string | null;
  name: string;
  description?: string | null;
  exam_importance: number;
  past_paper_frequency: number;
  mastery_score: number;
  source_sections?: unknown[];
  children?: Topic[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TopicMapResponse {
  subject_id: string;
  topics: Topic[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  topic_id?: string | null;
  question_index: number;
  question_type: QuestionType | string;
  question_text: string;
  options?: string[] | null;
  difficulty: Difficulty | string;
  citations?: Citation[] | unknown[];
  correct_answer?: string;
  explanation?: string | null;
}

export interface Quiz {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  quiz_mode: QuizMode | string;
  difficulty: Difficulty | string;
  question_count: number;
  time_limit_seconds?: number | null;
  status: string;
  metadata?: Record<string, unknown>;
  questions: QuizQuestion[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface QuizStartResponse {
  attempt_id: string;
  quiz: Quiz;
}

export interface AnswerSubmission {
  question_id: string;
  answer_text: string;
}

export interface AnswerEvaluation {
  question_id: string;
  is_correct?: boolean | null;
  score?: number | null;
  classification?: AnswerClassification | null;
  evaluation?: Record<string, unknown>;
}

export interface QuizResultEvaluation {
  question_id: string;
  score?: number | null;
  classification?: string | null;
  is_correct?: boolean | null;
  explanation?: string | null;
  misconceptions?: string[];
  corrected_answer?: string | null;
  citations?: Citation[];
  evaluation?: Record<string, unknown>;
}

export interface QuizResult {
  attempt_id?: string;
  quiz_id?: string;
  score?: number | null;
  max_score?: number | null;
  percentage?: number;
  topic_performance?: Record<string, unknown>;
  evaluations?: QuizResultEvaluation[];
  answers?: AnswerEvaluation[];
  questions?: QuizQuestion[];
  status?: string;
  summary?: string | null;
  [key: string]: unknown;
}

export interface GapReport {
  id: string;
  user_id: string;
  subject_id: string;
  attempt_id?: string | null;
  summary?: string | null;
  topics: GapTopicItem[] | unknown[];
  overall_mastery?: number | null;
  weak_count: number;
  medium_count: number;
  strong_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GapTopicItem {
  topic_id: string;
  topic_name: string;
  mastery_score: number;
  classification: MasteryClass;
  questions_attempted?: number;
  evidence?: unknown[];
  recommended_focus?: string | null;
}

export interface RevisionTask {
  id: string;
  plan_id: string;
  user_id?: string;
  topic_id?: string | null;
  title: string;
  priority: number;
  duration_minutes: number;
  activity: string;
  source_material?: unknown[];
  practice_questions?: unknown[];
  completion_status: TaskStatus | string;
  target_mastery?: number | null;
  prioritization_reason?: string | null;
  scheduled_day?: number | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RevisionPlan {
  id: string;
  user_id: string;
  subject_id: string;
  gap_report_id?: string | null;
  title: string;
  exam_date?: string | null;
  available_days?: number | null;
  hours_per_day?: number | null;
  preferences?: Record<string, unknown>;
  change_reason?: string | null;
  status: PlanStatus | string;
  tasks: RevisionTask[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id?: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  citations?: Citation[] | unknown[];
  insufficient_context?: boolean;
  created_at?: string | null;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  subject_id?: string | null;
  topic_id?: string | null;
  title?: string | null;
  messages: ChatMessage[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChatResponse {
  session: ChatSession;
  assistant_message: ChatMessage;
}

export interface ProgressOverview {
  overall_mastery: number;
  weak_topics: number;
  medium_topics: number;
  strong_topics: number;
  study_streak: number;
  quizzes_completed: number;
  plan_completion_pct: number;
  improvement_pct: number;
  subjects?: Record<string, unknown>[];
}

export interface DashboardData {
  welcome_name?: string | null;
  study_streak: number;
  current_subject_id?: string | null;
  upcoming_tasks: Array<{
    id: string;
    title: string;
    priority?: number;
    duration_minutes?: number;
    status?: string;
  }>;
  recent_gap_summary?: string | null;
  overall_mastery: number;
  weak_topic_count: number;
}

export interface AnalyticsData {
  overview: ProgressOverview;
  mastery_distribution: Array<{
    topic: string;
    mastery: number;
    classification: string;
  }>;
  quiz_performance_over_time: Array<{
    attempt_id?: string;
    date?: string | null;
    score_pct: number;
  }>;
  topic_progress_lines: Array<{
    topic: string;
    points: Array<{ attempt: number; score: number }>;
  }>;
  most_improved_topics: Array<{
    topic: string;
    delta: number;
    mastery: number;
  }>;
  persistent_weak_topics: Array<{
    topic: string;
    mastery: number;
    attempts: number;
  }>;
  attempt_history: Array<{
    attempt_id?: string;
    date?: string | null;
    score_pct: number;
  }>;
  cache_metrics?: Record<string, unknown> | null;
}
