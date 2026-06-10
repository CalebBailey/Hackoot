import { create } from "zustand";
import { Session, Participant, AnswerRecord, LeaderboardEntry, Question } from "../types";
import { DEFAULT_QUESTION_TIME_LIMIT, sanitizeQuestionTimeLimit } from "@/utils/scoring";

interface SessionStore {
  session: Session | null;
  peerError: string | null;
  currentQuestion: Question | null;
  isHost: boolean;
  participantId: string | null;
  participantName: string | null;
  lastPointsAwarded: number;
  hasAnsweredCurrentQuestion: boolean;
  currentQuestionDuration: number;
  
  // Actions
  initSession: (sessionId: string, quizId: string, roomCode: string) => void;
  setHasAnsweredCurrentQuestion: (answered: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setParticipant: (participantId: string, name: string) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  markParticipantDisconnected: (participantId: string) => void;
  startQuestion: (questionIndex: number, question: Question, questionDuration?: number) => void;
  setCurrentQuestion: (question: Question | null) => void;
  recordAnswer: (
    participantId: string,
    questionId: string,
    choiceId: string,
    submittedAt: number,
    correct: boolean,
    pointsAwarded: number
  ) => void;
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
  isHost: false,
  participantId: null,
  participantName: null,
  lastPointsAwarded: 0,
  hasAnsweredCurrentQuestion: false,
  currentQuestionDuration: DEFAULT_QUESTION_TIME_LIMIT,

  initSession: (sessionId, quizId, roomCode) => {
    set({
      session: {
        sessionId,
        quizId,
        roomCode,
        state: "lobby",
        participants: [],
        currentQuestionIndex: null,
        questionStartedAt: null,
        answers: [],
      },
      peerError: null,
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
    const resolvedDuration = sanitizeQuestionTimeLimit(questionDuration ?? question.timeLimit);
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          state: "question",
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
      };
    });
  },

  setCurrentQuestion: (question) => set({ currentQuestion: question }),

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
      isHost: false,
      participantId: null,
      participantName: null,
      lastPointsAwarded: 0,
      hasAnsweredCurrentQuestion: false,
      currentQuestionDuration: DEFAULT_QUESTION_TIME_LIMIT,
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
