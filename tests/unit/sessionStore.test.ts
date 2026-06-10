import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/store/sessionStore";
import { Question } from "@/types";
import { DEFAULT_QUESTION_TIME_LIMIT } from "@/utils/scoring";

const sampleQuestion: Question = {
  id: "q1",
  type: "mcq",
  text: "Question",
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  correctChoiceIds: ["a"],
};

const timedQuestion: Question = {
  ...sampleQuestion,
  id: "q2",
  timeLimit: 30,
};

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("initializes a session", () => {
    useSessionStore.getState().initSession("s1", "quiz1", "ROOM01");
    const session = useSessionStore.getState().session;

    expect(session?.sessionId).toBe("s1");
    expect(session?.state).toBe("lobby");
    expect(session?.participants).toHaveLength(0);
  });

  it("adds participants once", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");

    store.addParticipant({ participantId: "p1", name: "Alice", score: 0, answeredCurrentQuestion: false });
    store.addParticipant({ participantId: "p1", name: "Alice", score: 0, answeredCurrentQuestion: false });

    expect(useSessionStore.getState().session?.participants).toHaveLength(1);
  });

  it("starts a question and resets answer flags", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");
    store.addParticipant({ participantId: "p1", name: "Alice", score: 0, answeredCurrentQuestion: true });

    store.startQuestion(0, sampleQuestion);

    const session = useSessionStore.getState().session;
    expect(session?.state).toBe("question");
    expect(session?.currentQuestionIndex).toBe(0);
    expect(session?.participants[0].answeredCurrentQuestion).toBe(false);
  });

  it("uses default duration for legacy questions without time limit", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");

    store.startQuestion(0, sampleQuestion);

    expect(useSessionStore.getState().currentQuestionDuration).toBe(DEFAULT_QUESTION_TIME_LIMIT);
  });

  it("uses question time limit when present", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");

    store.startQuestion(0, timedQuestion);

    expect(useSessionStore.getState().currentQuestionDuration).toBe(30);
  });

  it("prefers explicit duration argument and normalizes invalid values", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");

    store.startQuestion(0, timedQuestion, 5);
    expect(useSessionStore.getState().currentQuestionDuration).toBe(5);

    store.startQuestion(1, timedQuestion, 120);
    expect(useSessionStore.getState().currentQuestionDuration).toBe(120);

    store.startQuestion(2, timedQuestion, 0);
    expect(useSessionStore.getState().currentQuestionDuration).toBe(1);
  });

  it("records an answer and updates score", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");
    store.addParticipant({ participantId: "p1", name: "Alice", score: 0, answeredCurrentQuestion: false });

    store.recordAnswer("p1", "q1", "a", 1000, true, 750);

    const session = useSessionStore.getState().session;
    expect(session?.answers).toHaveLength(1);
    expect(session?.participants[0].score).toBe(750);
    expect(session?.participants[0].answeredCurrentQuestion).toBe(true);
  });

  it("sorts leaderboard descending by score", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");
    store.addParticipant({ participantId: "p1", name: "Alice", score: 500, answeredCurrentQuestion: false });
    store.addParticipant({ participantId: "p2", name: "Bob", score: 900, answeredCurrentQuestion: false });

    const leaderboard = store.getLeaderboard();

    expect(leaderboard[0]).toMatchObject({ participantId: "p2", rank: 1 });
    expect(leaderboard[1]).toMatchObject({ participantId: "p1", rank: 2 });
  });

  it("reset restores default question duration", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM01");
    store.startQuestion(0, timedQuestion);

    store.reset();

    expect(useSessionStore.getState().currentQuestionDuration).toBe(DEFAULT_QUESTION_TIME_LIMIT);
  });
});
