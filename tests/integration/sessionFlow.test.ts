import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/store/sessionStore";
import { calculateKahootPoints } from "@/utils/scoring";
import { Question } from "@/types";

const question: Question = {
  id: "q-1",
  type: "mcq",
  text: "2 + 2",
  choices: [
    { id: "a", text: "4" },
    { id: "b", text: "5" },
  ],
  correctChoiceIds: ["a"],
};

describe("session flow stress simulation", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("handles 25 participants answering the same question", () => {
    const store = useSessionStore.getState();
    store.initSession("s1", "quiz1", "ROOM25");

    for (let i = 0; i < 25; i++) {
      store.addParticipant({
        participantId: `p-${i}`,
        name: `Player ${i}`,
        score: 0,
        answeredCurrentQuestion: false,
      });
    }

    store.startQuestion(0, question);

    for (let i = 0; i < 25; i++) {
      const correct = i % 2 === 0;
      const choiceId = correct ? "a" : "b";
      const responseSeconds = 1 + (i % 5);
      const points = calculateKahootPoints(correct, responseSeconds, 20);

      store.recordAnswer(`p-${i}`, question.id, choiceId, Date.now() + i, correct, points);
    }

    const session = useSessionStore.getState().session;
    const leaderboard = useSessionStore.getState().getLeaderboard();

    expect(session?.participants).toHaveLength(25);
    expect(session?.answers).toHaveLength(25);
    expect(session?.participants.every((p) => p.answeredCurrentQuestion)).toBe(true);
    expect(leaderboard).toHaveLength(25);
    expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[24].score);
  });
});
