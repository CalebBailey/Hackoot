import { QuizType, TeamBuildingQuizSettings } from "@/types";

export const DEFAULT_TEAM_BUILDING_SETTINGS: TeamBuildingQuizSettings = {
  enableWordCloud: true,
  enableFuzzyGrouping: false,
  enableDiscussionVoting: true,
  saveOutputsForReuse: false,
  maxAnswersPerPlayer: 3,
  maxVotesPerPlayer: 3,
  allowOwnAnswerVoting: true,
  anonymousDiscussionVotes: true,
  hostReviewBeforeDisplay: false,
};

export function resolveQuizType(quizType: QuizType | undefined): QuizType {
  return quizType ?? "standard";
}
