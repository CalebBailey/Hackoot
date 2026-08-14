export type QuizType = "standard" | "team-building";

export interface Choice {
  id: string;
  text: string;
}

export interface TeamBuildingQuizSettings {
  enableFuzzyGrouping: boolean;
  enableDiscussionVoting: boolean;
  saveOutputsForReuse: boolean;
  maxAnswersPerPlayer: number;
  maxVotesPerPlayer: number;
  allowOwnAnswerVoting: boolean;
  anonymousDiscussionVotes: boolean;
  hostReviewBeforeDisplay: boolean;
}

export interface StandardMcqQuestion {
  id: string;
  type: "mcq";
  text: string;
  imageUrl?: string;
  choices: Choice[];
  correctChoiceIds: string[];
  doublePoints?: boolean;
  timeLimit?: number;
}

export interface TeamThisOrThatQuestion {
  id: string;
  type: "this-or-that";
  text: string;
  imageUrl?: string;
  options: [Choice, Choice];
  timeLimit?: number;
}

export interface TeamFreeTextQuestion {
  id: string;
  type: "free-text";
  text: string;
  imageUrl?: string;
  maxAnswersPerPlayer?: number;
  timeLimit?: number;
}

export interface TeamSelectOrTextQuestion {
  id: string;
  type: "select-or-text";
  text: string;
  imageUrl?: string;
  options: Choice[];
  allowCustomAnswer?: boolean;
  maxAnswersPerPlayer?: number;
  timeLimit?: number;
}

export interface TeamDiscussionQuestion {
  id: string;
  type: "discussion";
  text: string;
  imageUrl?: string;
  maxAnswersPerPlayer?: number;
  maxVotesPerPlayer?: number;
  timeLimit?: number;
}

export type Question =
  | StandardMcqQuestion
  | TeamThisOrThatQuestion
  | TeamFreeTextQuestion
  | TeamSelectOrTextQuestion
  | TeamDiscussionQuestion;

export type PublicQuestion =
  | Omit<StandardMcqQuestion, "correctChoiceIds">
  | TeamThisOrThatQuestion
  | TeamFreeTextQuestion
  | TeamSelectOrTextQuestion
  | TeamDiscussionQuestion;

export interface Quiz {
  quizId: string;
  title: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  version: number;
  quizType?: QuizType;
  teamBuildingSettings?: TeamBuildingQuizSettings;
  questions: Question[];
}

export type SessionState =
  | "lobby"
  | "question"
  | "team-submission"
  | "team-voting"
  | "team-results"
  | "team-discussion"
  | "reveal"
  | "leaderboard"
  | "ended";

export type TeamResultSessionState = "team-results" | "team-discussion";

export interface TeamAnswerCluster {
  id: string;
  canonicalText: string;
  answerTexts?: string[];
  answerIds: string[];
  participantIds: string[];
  count: number;
}

export interface ParticipantDirectoryEntry {
  participantId: string;
  name: string;
}

export interface DiscussionQueueItem {
  id: string;
  text: string;
  participantIds: string[];
  voterParticipantIds?: string[];
  voteCount: number;
  voteShare: number;
  hidden?: boolean;
  skipped?: boolean;
  discussed?: boolean;
}

export interface Session {
  sessionId: string;
  quizId: string;
  roomCode: string;
  state: SessionState;
  quizType?: QuizType;
  participants: Participant[];
  currentQuestionIndex: number | null;
  questionStartedAt: number | null;
  answers: AnswerRecord[];
  teamClusters?: Record<string, TeamAnswerCluster[]>;
  teamDiscussionQueue?: Record<string, DiscussionQueueItem[]>;
  teamQuestionPrompts?: Record<string, string>;
}

export interface Participant {
  participantId: string;
  name: string;
  score: number;
  answeredCurrentQuestion: boolean;
  disconnected?: boolean;
}

export interface AnswerRecord {
  participantId: string;
  questionId: string;
  submittedAt: number;
  choiceId?: string;
  textAnswers?: string[];
  voteAnswerIds?: string[];
  correct?: boolean;
  pointsAwarded?: number;
}

export interface LeaderboardEntry {
  participantId: string;
  name: string;
  score: number;
  rank: number;
}

export interface DiscussionVoteCandidate {
  id: string;
  text: string;
  participantId: string;
  participantIds?: string[];
  displayName?: string;
}

export type PeerMessage =
  | { type: "join"; name: string; participantId: string }
  | { type: "joinAck"; participantId: string }
  | { type: "submitAnswer"; participantId: string; questionId: string; choiceId: string; submittedAt: number }
  | { type: "submitChoiceAnswer"; participantId: string; questionId: string; choiceId: string; submittedAt: number }
  | { type: "submitTextAnswers"; participantId: string; questionId: string; answers: string[]; submittedAt: number }
  | { type: "submitDiscussionVotes"; participantId: string; questionId: string; answerIds: string[]; submittedAt: number }
  | { type: "lobbyUpdate"; participants: { id: string; name: string }[] }
  | {
      type: "questionStarted";
      question: PublicQuestion;
      questionIndex: number;
      totalQuestions: number;
      startedAt: number;
      doublePoints?: boolean;
      questionDuration: number;
      discussionIntroParticipantIds?: string[];
    }
  | { type: "answerRevealed"; correctChoiceIds: string[]; leaderboard: LeaderboardEntry[]; playerPoints: Record<string, number> }
  | { type: "teamSubmissionClosed"; questionId: string; submissionCount: number }
  | {
      type: "teamVotingOpened";
      questionId: string;
      candidates: DiscussionVoteCandidate[];
      maxVotesPerPlayer: number;
      allowOwnAnswerVoting: boolean;
    }
  | { type: "teamVotingClosed"; questionId: string }
  | {
      type: "teamResultsPublished";
      questionId: string;
      groupedAnswers?: TeamAnswerCluster[];
      discussionQueue?: DiscussionQueueItem[];
      participants?: ParticipantDirectoryEntry[];
      sessionState?: TeamResultSessionState;
    }
  | { type: "teamDiscussionItemOpened"; questionId: string; item: DiscussionQueueItem }
  | { type: "sessionEnded"; finalLeaderboard: LeaderboardEntry[] }
  | { type: "error"; message: string }
  | {
      type: "rejoinAck";
      participantId: string;
      sessionState: Session["state"];
      quizType?: QuizType;
      score: number;
      answeredCurrentQuestion?: boolean;
      question?: PublicQuestion;
      questionIndex?: number;
      totalQuestions?: number;
      questionDuration?: number;
      discussionIntroParticipantIds?: string[];
      leaderboard?: LeaderboardEntry[];
      teamVoteContext?: {
        questionId: string;
        candidates: DiscussionVoteCandidate[];
        maxVotesPerPlayer: number;
        allowOwnAnswerVoting: boolean;
      };
      teamResultsSnapshot?: {
        questionId: string;
        groupedAnswers: TeamAnswerCluster[];
        discussionQueue: DiscussionQueueItem[];
        participants?: ParticipantDirectoryEntry[];
      };
      participants?: ParticipantDirectoryEntry[];
    };
