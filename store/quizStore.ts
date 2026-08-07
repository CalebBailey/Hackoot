import { create } from "zustand";
import { Quiz } from "../types";
import { saveQuiz, loadAllQuizzes, deleteQuiz as deleteQuizFromStorage } from "../utils/quizStorage";
import { generateUUID } from "../lib/utils";
import { DEFAULT_TEAM_BUILDING_SETTINGS, resolveQuizType } from "@/utils/teamBuilding";

function withQuizDefaults(quiz: Quiz): Quiz {
  const quizType = resolveQuizType(quiz.quizType);
  return {
    ...quiz,
    quizType,
    teamBuildingSettings:
      quizType === "team-building"
        ? {
            ...DEFAULT_TEAM_BUILDING_SETTINGS,
            ...(quiz.teamBuildingSettings ?? {}),
          }
        : undefined,
  };
}

interface QuizStore {
  quizzes: Quiz[];
  loadFromStorage: () => void;
  createQuiz: (quiz: Quiz) => void;
  updateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (quizId: string) => void;
  importQuiz: (quiz: Quiz) => void;
  getQuizById: (quizId: string) => Quiz | undefined;
}

export const useQuizStore = create<QuizStore>((set, get) => ({
  quizzes: [],

  loadFromStorage: () => {
    const quizzes = loadAllQuizzes();
    set({ quizzes });
  },

  createQuiz: (quiz: Quiz) => {
    const normalisedQuiz = withQuizDefaults(quiz);
    saveQuiz(normalisedQuiz);
    set((state) => ({ quizzes: [...state.quizzes, normalisedQuiz] }));
  },

  updateQuiz: (quiz: Quiz) => {
    const normalisedQuiz = withQuizDefaults(quiz);
    saveQuiz(normalisedQuiz);
    set((state) => ({
      quizzes: state.quizzes.map((q) => (q.quizId === normalisedQuiz.quizId ? normalisedQuiz : q)),
    }));
  },

  deleteQuiz: (quizId: string) => {
    deleteQuizFromStorage(quizId);
    set((state) => ({
      quizzes: state.quizzes.filter((q) => q.quizId !== quizId),
    }));
  },

  importQuiz: (quiz: Quiz) => {
    // Generate new ID to avoid conflicts
    const importedQuiz = withQuizDefaults({
      ...quiz,
      quizId: generateUUID(),
      createdAt: new Date().toISOString(),
      version: 1,
    });
    saveQuiz(importedQuiz);
    set((state) => ({ quizzes: [...state.quizzes, importedQuiz] }));
  },

  getQuizById: (quizId: string) => {
    return get().quizzes.find((q) => q.quizId === quizId);
  },
}));
