"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Timer } from "../Timer";
import { AnswerGrid } from "../AnswerGrid";
import { navigate } from "../HackootApp";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { QUESTION_TIME_LIMIT } from "@/utils/scoring";

export function PlayerQuestionPage() {
  const session = useSessionStore((state) => state.session);
  const currentQuestion = useSessionStore((state) => state.currentQuestion);
  const participantId = useSessionStore((state) => state.participantId);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [timerRunning, setTimerRunning] = useState(true);

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;

  useEffect(() => {
    if (!playerPeer || !currentQuestion) {
      navigate("/join");
      return;
    }

    // Reset state for new question
    setSelectedId(null);
    setLocked(false);
    setTimerRunning(true);

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "answerRevealed") {
        const pointsAwarded = participantId ? (message.playerPoints[participantId] ?? 0) : 0;
        updateLeaderboard(message.leaderboard, pointsAwarded);
        navigate("/play/result");
      } else if (message.type === "sessionEnded") {
        updateLeaderboard(message.finalLeaderboard, 0);
        navigate("/play/final");
      }
    };
  }, [playerPeer, currentQuestion, participantId, updateLeaderboard]);

  const handleSelect = (choiceId: string) => {
    if (locked || !playerPeer || !currentQuestion) return;

    setSelectedId(choiceId);
    setLocked(true);
    setTimerRunning(false);

    playerPeer.send({
      type: "submitAnswer",
      participantId: participantId!,
      questionId: currentQuestion.id,
      choiceId,
      submittedAt: Date.now(),
    });
  };

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    setLocked(true);
  }, []);

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl min-h-screen flex flex-col">
      {/* Question info */}
      <div className="text-center mb-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Up to 1000 points
        </p>
      </div>

      {/* Timer - fixed 20 seconds */}
      <div className="flex justify-center mb-6">
        <Timer
          totalSeconds={QUESTION_TIME_LIMIT}
          onExpire={handleTimerExpire}
          running={timerRunning}
        />
      </div>

      {/* Question */}
      <div 
        className="glass-card p-6 mb-6 text-center"
        role="region"
        aria-live="assertive"
        aria-label="Current question"
      >
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)] text-balance">
          {currentQuestion.text}
        </h2>
        {currentQuestion.imageUrl && (
          <div className="mt-4 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Question illustration"
              className="max-h-48 rounded-lg object-contain"
            />
          </div>
        )}
      </div>

      {/* Answer Grid */}
      <div className="flex-1 flex items-center justify-center">
        <AnswerGrid
          choices={currentQuestion.choices}
          onSelect={handleSelect}
          selectedId={selectedId || undefined}
          locked={locked}
        />
      </div>

      {/* Status */}
      {locked && (
        <div className="text-center mt-6">
          <p className="text-[var(--text-secondary)]">
            {selectedId ? "Answer submitted! Waiting for results..." : "Time's up!"}
          </p>
        </div>
      )}
    </div>
  );
}
