import { Question, Quiz } from "@/types";
import { sanitizeQuestionTimeLimit } from "@/utils/scoring";

export interface QuizDurationEstimateConfig {
  sessionOverheadSeconds: number;
  perQuestionBufferSeconds: number;
  discussionExtraSeconds: number;
}

export interface QuizDurationEstimate {
  questionTimeSeconds: number;
  extraTimeSeconds: number;
  totalSeconds: number;
}

export const DEFAULT_QUIZ_DURATION_ESTIMATE_CONFIG: QuizDurationEstimateConfig = {
  sessionOverheadSeconds: 60,
  perQuestionBufferSeconds: 10,
  discussionExtraSeconds: 180,
};

function mergeConfig(
  config?: Partial<QuizDurationEstimateConfig>
): QuizDurationEstimateConfig {
  return {
    ...DEFAULT_QUIZ_DURATION_ESTIMATE_CONFIG,
    ...config,
  };
}

export function estimateQuizDurationFromQuestions(
  questions: Question[],
  config?: Partial<QuizDurationEstimateConfig>
): QuizDurationEstimate {
  const resolvedConfig = mergeConfig(config);
  const questionTimeSeconds = questions.reduce(
    (total, question) => total + sanitizeQuestionTimeLimit(question.timeLimit),
    0
  );

  const discussionQuestionCount = questions.filter(
    (question) => question.type === "discussion"
  ).length;

  const extraTimeSeconds =
    resolvedConfig.sessionOverheadSeconds +
    resolvedConfig.perQuestionBufferSeconds * questions.length +
    resolvedConfig.discussionExtraSeconds * discussionQuestionCount;

  return {
    questionTimeSeconds,
    extraTimeSeconds,
    totalSeconds: questionTimeSeconds + extraTimeSeconds,
  };
}

export function estimateQuizDuration(
  quiz: Pick<Quiz, "questions">,
  config?: Partial<QuizDurationEstimateConfig>
): QuizDurationEstimate {
  return estimateQuizDurationFromQuestions(quiz.questions, config);
}

export function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}