"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { navigate } from "../HackootApp";
import { CheckCircle, XCircle, Trophy } from "lucide-react";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";

export function PlayerResultPage() {
  const session = useSessionStore((state) => state.session);
  const participantId = useSessionStore((state) => state.participantId);
  const lastPointsAwarded = useSessionStore((state) => state.lastPointsAwarded);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const startQuestion = useSessionStore((state) => state.startQuestion);
  const setCurrentQuestion = useSessionStore((state) => state.setCurrentQuestion);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);

  const [displayedPoints, setDisplayedPoints] = useState(0);

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;

  // Animate points
  useEffect(() => {
    if (lastPointsAwarded > 0) {
      const duration = 500;
      const steps = 20;
      const increment = lastPointsAwarded / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= lastPointsAwarded) {
          setDisplayedPoints(lastPointsAwarded);
          clearInterval(interval);
        } else {
          setDisplayedPoints(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }
  }, [lastPointsAwarded]);

  useEffect(() => {
    if (!playerPeer) {
      navigate("/join");
      return;
    }

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "questionStarted") {
        setCurrentQuestion({
          ...message.question,
          correctChoiceIds: [],
        });
        startQuestion(message.questionIndex, {
          ...message.question,
          correctChoiceIds: [],
        }, message.questionDuration);
        navigate("/play/question");
      } else if (message.type === "sessionEnded") {
        updateLeaderboard(message.finalLeaderboard, 0);
        navigate("/play/final");
      }
    };
  }, [playerPeer, startQuestion, setCurrentQuestion, updateLeaderboard]);

  const leaderboard = getLeaderboard();
  const myEntry = leaderboard.find((e) => e.participantId === participantId);
  const myRank = myEntry?.rank || 0;
  const myScore = myEntry?.score || 0;
  const gotPoints = lastPointsAwarded > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-md min-h-screen flex flex-col justify-center">
      <div className="glass-card p-6 sm:p-8 text-center">
        {/* Result icon */}
        <div className="mb-6">
          {gotPoints ? (
            <CheckCircle className="w-20 h-20 mx-auto text-[#10B981]" />
          ) : (
            <XCircle className="w-20 h-20 mx-auto text-[#F43F5E]" />
          )}
        </div>

        {/* Result text */}
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)] mb-2">
          {gotPoints ? "Correct!" : "Incorrect"}
        </h1>

        {/* Points earned */}
        <div className="mb-8">
          <p className="text-[var(--text-secondary)] mb-2">Points earned</p>
          <p className="text-5xl font-heading font-bold text-[var(--text-primary)] count-up">
            +{displayedPoints}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Your Rank</p>
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                #{myRank}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Total Score</p>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {myScore.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--text-secondary)]">
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span className="text-sm">Waiting for next question...</span>
        </div>
      </div>
    </div>
  );
}
