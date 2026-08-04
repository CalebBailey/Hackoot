import { create } from "zustand";
import {
  Session,
  Participant,
  AnswerRecord,
  LeaderboardEntry,
  Question,
  QuizType,
  DiscussionVoteCandidate,
  DiscussionQueueItem,
  TeamAnswerCluster,
  WordCloudTerm,
  SessionState,
} from "../types";
import { DEFAULT_QUESTION_TIME_LIMIT, sanitizeQuestionTimeLimit } from "@/utils/scoring";

interface TeamVoteContext {
  questionId: string;
  candidates: DiscussionVoteCandidate[];
  maxVotesPerPlayer: number;
  allowOwnAnswerVoting: boolean;
}

interface TeamResultsSnapshot {
  questionId: string;
  groupedAnswers: TeamAnswerCluster[];
  wordCloud: WordCloudTerm[];
  discussionQueue: DiscussionQueueItem[];
}

interface SessionStore {
  session: Session | null;
  peerError: string | null;
  currentQuestion: Question | null;
  activeQuizType: QuizType;
  isHost: boolean;
  participantId: string | null;
  participantName: string | null;
  lastPointsAwarded: number;
  hasAnsweredCurrentQuestion: boolean;
  currentQuestionDuration: number;
  teamVoteContext: TeamVoteContext | null;
  teamResultsSnapshot: TeamResultsSnapshot | null;
  
  // Actions
  initSession: (sessionId: string, quizId: string, roomCode: string, quizType?: QuizType) => void;
  setHasAnsweredCurrentQuestion: (answered: boolean) => void;
  setActiveQuizType: (quizType: QuizType) => void;
  setSessionQuizType: (quizType: QuizType) => void;
  setIsHost: (isHost: boolean) => void;
  setParticipant: (participantId: string, name: string) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  markParticipantDisconnected: (participantId: string) => void;
  startQuestion: (questionIndex: number, question: Question, questionDuration?: number) => void;
  setCurrentQuestion: (question: Question | null) => void;
  setSessionState: (state: SessionState) => void;
  recordAnswer: (
    participantId: string,
    questionId: string,
    choiceId: string,
    submittedAt: number,
    correct: boolean,
    pointsAwarded: number
  ) => void;
  recordTeamChoiceAnswer: (participantId: string, questionId: string, choiceId: string, submittedAt: number) => void;
  recordTeamTextAnswers: (participantId: string, questionId: string, answers: string[], submittedAt: number) => void;
  recordTeamVotes: (participantId: string, questionId: string, answerIds: string[], submittedAt: number) => void;
  setTeamVoteContext: (ctx: TeamVoteContext | null) => void;
  setTeamResultsSnapshot: (snapshot: TeamResultsSnapshot | null) => void;
  markParticipantAnswered: (participantId: string) => void;
  revealAnswer: () => void;
  updateLeaderboard: (leaderboard: LeaderboardEntry[], pointsAwarded: number) => void;
  endSession: () => void;
  reset: () => void;
  setPeerError: (error: string | null) => void;
  getLeaderboard: () => LeaderboardEntry[];
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  peerError: null,
  currentQuestion: null,
  activeQuizType: "standard",
  isHost: false,
  participantId: null,
  participantName: null,
  lastPointsAwarded: 0,
  hasAnsweredCurrentQuestion: false,
  currentQuestionDuration: DEFAULT_QUESTION_TIME_LIMIT,
  teamVoteContext: null,
  teamResultsSnapshot: null,

  initSession: (sessionId, quizId, roomCode, quizType = "standard") => {
    set({
      session: {
        sessionId,
        quizId,
        roomCode,
        quizType,
        state: "lobby",
        participants: [],
        currentQuestionIndex: null,
        questionStartedAt: null,
        answers: [],
        teamClusters: {},
        teamWordCloud: {},
        teamDiscussionQueue: {},
      },
      activeQuizType: quizType,
      peerError: null,
      teamVoteContext: null,
      teamResultsSnapshot: null,
    });
  },

  setActiveQuizType: (quizType) => set({ activeQuizType: quizType }),

  setSessionQuizType: (quizType) => {
    set((state) => {
      if (!state.session) {
        return {
          activeQuizType: quizType,
        };
      }

      return {
        activeQuizType: quizType,
        session: {
          ...state.session,
          quizType,
        },
      };
    });
  },

  setIsHost: (isHost) => set({ isHost }),

  setParticipant: (participantId, name) => set({ participantId, participantName: name }),

  addParticipant: (participant) => {
    set((state) => {
      if (!state.session) return state;
      const exists = state.session.participants.some(p => p.participantId === participant.participantId);
      if (exists) return state;
      return {
        session: {
          ...state.session,
          participants: [...state.session.participants, participant],
        },
      };
    });
  },

  removeParticipant: (participantId) => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          participants: state.session.participants.filter(p => p.participantId !== participantId),
        },
      };
    });
  },

  markParticipantDisconnected: (participantId) => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          participants: state.session.participants.map(p =>
            p.participantId === participantId ? { ...p, disconnected: true } : p
          ),
        },
      };
    });
  },

  setHasAnsweredCurrentQuestion: (answered) => set({ hasAnsweredCurrentQuestion: answered }),

  startQuestion: (questionIndex, question, questionDuration) => {
    const quizType = get().session?.quizType ?? get().activeQuizType;
    const resolvedDuration = sanitizeQuestionTimeLimit(questionDuration ?? question.timeLimit);
    set((state) => {
      if (!state.session) return state;
      const nextState: SessionState = quizType === "team-building" ? "team-submission" : "question";
      return {
        session: {
          ...state.session,
          state: nextState,
          currentQuestionIndex: questionIndex,
          questionStartedAt: Date.now(),
          participants: state.session.participants.map(p => ({
            ...p,
            answeredCurrentQuestion: false,
          })),
        },
        currentQuestion: question,
        currentQuestionDuration: resolvedDuration,
        hasAnsweredCurrentQuestion: false,
        teamVoteContext: null,
        teamResultsSnapshot: null,
      };
    });
  },

  setCurrentQuestion: (question) => set({ currentQuestion: question }),

  setSessionState: (nextState) => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          state: nextState,
        },
      };
    });
  },

  recordAnswer: (participantId, questionId, choiceId, submittedAt, correct, pointsAwarded) => {
    set((state) => {
      if (!state.session) return state;
      const answer: AnswerRecord = {
        participantId,
        questionId,
        choiceId,
        submittedAt,
        correct,
        pointsAwarded,
      };
      return {
        session: {
          ...state.session,
          answers: [...state.session.answers, answer],
          participants: state.session.participants.map(p =>
            p.participantId === participantId
              ? { ...p, score: p.score + pointsAwarded, answeredCurrentQuestion: true }
              : p
          ),
        },
      };
    });
  },

  recordTeamChoiceAnswer: (participantId, questionId, choiceId, submittedAt) => {
    set((state) => {
      if (!state.session) return state;
      const answer: AnswerRecord = {
        participantId,
        questionId,
        choiceId,
        submittedAt,
      };
      return {
        session: {
          ...state.session,
          answers: [...state.session.answers, answer],
          participants: state.session.participants.map((p) =>
            p.participantId === participantId
              ? { ...p, answeredCurrentQuestion: true }
              : p
          ),
        },
      };
    });
  },

  recordTeamTextAnswers: (participantId, questionId, answers, submittedAt) => {
    set((state) => {
      if (!state.session) return state;
      const answer: AnswerRecord = {
        participantId,
        questionId,
        submittedAt,
        textAnswers: answers,
      };
      return {
        session: {
          ...state.session,
          answers: [...state.session.answers, answer],
          participants: state.session.participants.map((p) =>
            p.participantId === participantId
              ? { ...p, answeredCurrentQuestion: true }
              : p
          ),
        },
      };
    });
  },

  recordTeamVotes: (participantId, questionId, answerIds, submittedAt) => {
    set((state) => {
      if (!state.session) return state;
      const answer: AnswerRecord = {
        participantId,
        questionId,
        submittedAt,
        voteAnswerIds: answerIds,
      };
      return {
        session: {
          ...state.session,
          answers: [...state.session.answers, answer],
          participants: state.session.participants.map((p) =>
            p.participantId === participantId
              ? { ...p, answeredCurrentQuestion: true }
              : p
          ),
        },
      };
    });
  },

  setTeamVoteContext: (ctx) => set({ teamVoteContext: ctx }),

  setTeamResultsSnapshot: (snapshot) => {
    set((state) => {
      if (!state.session || !snapshot) {
        return {
          teamResultsSnapshot: snapshot,
        };
      }
      return {
        session: {
          ...state.session,
          state: "team-results",
          teamClusters: {
            ...state.session.teamClusters,
            [snapshot.questionId]: snapshot.groupedAnswers,
          },
          teamWordCloud: {
            ...state.session.teamWordCloud,
            [snapshot.questionId]: snapshot.wordCloud,
          },
          teamDiscussionQueue: {
            ...state.session.teamDiscussionQueue,
            [snapshot.questionId]: snapshot.discussionQueue,
          },
        },
        teamResultsSnapshot: snapshot,
      };
    });
  },

  markParticipantAnswered: (participantId) => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          participants: state.session.participants.map(p =>
            p.participantId === participantId
              ? { ...p, answeredCurrentQuestion: true }
              : p
          ),
        },
      };
    });
  },

  revealAnswer: () => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          state: "reveal",
        },
      };
    });
  },

  updateLeaderboard: (leaderboard, pointsAwarded) => {
    set((state) => {
      if (!state.session) return state;
      const existingIds = new Set(state.session.participants.map(p => p.participantId));
      const updatedParticipants = state.session.participants.map(p => {
        const entry = leaderboard.find(e => e.participantId === p.participantId);
        return entry ? { ...p, score: entry.score } : p;
      });
      const newParticipants = leaderboard
        .filter(e => !existingIds.has(e.participantId))
        .map(e => ({
          participantId: e.participantId,
          name: e.name,
          score: e.score,
          answeredCurrentQuestion: false,
        }));
      return {
        session: {
          ...state.session,
          state: "leaderboard",
          participants: [...updatedParticipants, ...newParticipants],
        },
        lastPointsAwarded: pointsAwarded,
      };
    });
  },

  endSession: () => {
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          state: "ended",
        },
      };
    });
  },

  reset: () => {
    set({
      session: null,
      peerError: null,
      currentQuestion: null,
      activeQuizType: "standard",
      isHost: false,
      participantId: null,
      participantName: null,
      lastPointsAwarded: 0,
      hasAnsweredCurrentQuestion: false,
      currentQuestionDuration: DEFAULT_QUESTION_TIME_LIMIT,
      teamVoteContext: null,
      teamResultsSnapshot: null,
    });
  },

  setPeerError: (error) => set({ peerError: error }),

  getLeaderboard: () => {
    const session = get().session;
    if (!session) return [];
    const sorted = [...session.participants]
      .sort((a, b) => b.score - a.score);
    return sorted.map((p, i) => ({
      participantId: p.participantId,
      name: p.name,
      score: p.score,
      rank: i + 1,
    }));
  },
}));
