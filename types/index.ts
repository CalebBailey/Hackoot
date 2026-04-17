export interface Quiz {
  quizId: string;
  title: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  version: number;
  questions: Question[];
}

export interface Question {
  id: string;
  type: "mcq";
  text: string;
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface Choice {
  id: string;
  text: string;
}

export interface Session {
  sessionId: string;
  quizId: string;
  roomCode: string;
  state: "lobby" | "question" | "reveal" | "leaderboard" | "ended";
  participants: Participant[];
  currentQuestionIndex: number | null;
  questionStartedAt: number | null;
  answers: AnswerRecord[];
}

export interface Participant {
  participantId: string;
  name: string;
  score: number;
  answeredCurrentQuestion: boolean;
}

export interface AnswerRecord {
  participantId: string;
  questionId: string;
  choiceId: string;
  submittedAt: number;
  correct: boolean;
  pointsAwarded: number;
}

export interface LeaderboardEntry {
  participantId: string;
  name: string;
  score: number;
  rank: number;
}

export type PeerMessage =
  | { type: "join"; name: string; participantId: string }
  | { type: "submitAnswer"; participantId: string; questionId: string; choiceId: string; submittedAt: number }
  | { type: "joinAck"; participantId: string }
  | { type: "lobbyUpdate"; participants: { id: string; name: string }[] }
  | { type: "questionStarted"; question: Omit<Question, "correctChoiceIds">; questionIndex: number; totalQuestions: number; startedAt: number }
  | { type: "answerRevealed"; correctChoiceIds: string[]; leaderboard: LeaderboardEntry[]; playerPoints: Record<string, number> }
  | { type: "sessionEnded"; finalLeaderboard: LeaderboardEntry[] }
  | { type: "error"; message: string };
