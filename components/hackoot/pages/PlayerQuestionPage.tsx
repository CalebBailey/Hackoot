"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Timer } from "../Timer";
import { AnswerGrid } from "../AnswerGrid";
import { navigate } from "../HackootApp";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { QUESTION_TIME_LIMIT } from "@/utils/scoring";
import { Zap } from "lucide-react";

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

  const isDoublePoints = currentQuestion.doublePoints ?? false;

  return (
    <div className="h-screen overflow-hidden flex flex-col px-4 py-4 max-w-2xl mx-auto">
      {isDoublePoints && <div className="double-points-vignette" aria-hidden="true" />}

      {/* Points info / double points badge */}
      <div className="flex justify-center mb-3">
        {isDoublePoints ? (
          <div className="double-points-badge flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold text-sm shadow-lg shadow-amber-500/20">
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
            Double Points - Up to 2000
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Up to 1000 points</p>
        )}
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-4">
        <Timer
          totalSeconds={QUESTION_TIME_LIMIT}
          onExpire={handleTimerExpire}
          running={timerRunning}
        />
      </div>

      {/* Question */}
      <div
        className="glass-card p-5 mb-4 text-center"
        role="region"
        aria-live="assertive"
        aria-label="Current question"
      >
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)] text-balance">
          {currentQuestion.text}
        </h2>
        {currentQuestion.imageUrl && (
          <div className="mt-3 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Question illustration"
              className="max-h-36 rounded-lg object-contain"
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
        <div className="text-center py-3">
          <p className="text-[var(--text-secondary)]">
            {selectedId ? "Answer submitted! Waiting for results..." : "Time's up!"}
          </p>
        </div>
      )}
    </div>
  );
}
