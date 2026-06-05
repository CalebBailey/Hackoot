import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Quiz } from "@/types";

const mockSaveQuiz = vi.fn();
const mockLoadAllQuizzes = vi.fn();
const mockDeleteQuiz = vi.fn();

vi.mock("@/utils/quizStorage", () => ({
  saveQuiz: mockSaveQuiz,
  loadAllQuizzes: mockLoadAllQuizzes,
  deleteQuiz: mockDeleteQuiz,
}));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    generateUUID: () => "generated-uuid",
  };
});

const baseQuiz: Quiz = {
  quizId: "q1",
  title: "Quiz",
  createdAt: new Date().toISOString(),
  version: 1,
  questions: [],
};

async function getStore() {
  const mod = await import("@/store/quizStore");
  return mod.useQuizStore;
}

describe("quizStore", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockLoadAllQuizzes.mockReturnValue([]);
    const store = await getStore();
    store.setState({ quizzes: [] });
  });

  it("loads quizzes from storage", async () => {
    mockLoadAllQuizzes.mockReturnValue([baseQuiz]);
    const store = await getStore();

    store.getState().loadFromStorage();

    expect(store.getState().quizzes).toHaveLength(1);
  });

  it("creates and stores a quiz", async () => {
    const store = await getStore();

    store.getState().createQuiz(baseQuiz);

    expect(mockSaveQuiz).toHaveBeenCalledWith(baseQuiz);
    expect(store.getState().quizzes[0].quizId).toBe("q1");
  });

  it("updates a quiz by id", async () => {
    const store = await getStore();
    store.getState().createQuiz(baseQuiz);

    store.getState().updateQuiz({ ...baseQuiz, title: "Updated" });

    expect(store.getState().quizzes[0].title).toBe("Updated");
  });

  it("deletes a quiz by id", async () => {
    const store = await getStore();
    store.getState().createQuiz(baseQuiz);

    store.getState().deleteQuiz("q1");

    expect(mockDeleteQuiz).toHaveBeenCalledWith("q1");
    expect(store.getState().quizzes).toHaveLength(0);
  });

  it("imports a quiz with a new generated id", async () => {
    const store = await getStore();

    store.getState().importQuiz(baseQuiz);

    const [imported] = store.getState().quizzes;
    expect(imported.quizId).toBe("generated-uuid");
    expect(imported.version).toBe(1);
    expect(mockSaveQuiz).toHaveBeenCalled();
  });
});
