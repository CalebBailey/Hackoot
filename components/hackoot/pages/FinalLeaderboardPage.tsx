"use client";

import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { navigate } from "../HackootApp";
import { Trophy, Download, Home, Medal } from "lucide-react";
import { exportSessionResults } from "@/utils/quizStorage";

export function FinalLeaderboardPage() {
  const session = useSessionStore((state) => state.session);
  const isHost = useSessionStore((state) => state.isHost);
  const participantId = useSessionStore((state) => state.participantId);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const reset = useSessionStore((state) => state.reset);

  const leaderboard = getLeaderboard();

  const handleDownload = () => {
    if (!session) return;
    exportSessionResults(
      {
        sessionId: session.sessionId,
        roomCode: session.roomCode,
        participants: session.participants,
        answers: session.answers,
        leaderboard,
        endedAt: new Date().toISOString(),
      },
      session.quizId || "hackoot-results"
    );
  };

  const handlePlayAgain = () => {
    // Clean up peer connections
    const hostPeer = (window as any).__hackootHostPeer;
    const playerPeer = (window as any).__hackootPlayerPeer;
    hostPeer?.disconnect();
    playerPeer?.disconnect();
    (window as any).__hackootHostPeer = null;
    (window as any).__hackootPlayerPeer = null;
    
    reset();
    navigate("/");
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-8 h-8 text-[#F59E0B]" />;
    if (rank === 2) return <Medal className="w-7 h-7 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-700" />;
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-[#F59E0B]" />
        <h1 className="text-3xl sm:text-4xl font-heading font-bold text-[var(--text-primary)]">
          Final Results
        </h1>
      </div>

      {/* Podium - Top 3 */}
      {top3.length > 0 && (
        <div className="flex justify-center items-end gap-4 mb-8">
          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center scale-in" style={{ animationDelay: "0.1s" }}>
              <div className="glass-card p-4 text-center w-24 sm:w-28">
                {getRankIcon(2)}
                <p className="font-semibold text-[var(--text-primary)] mt-2 truncate">
                  {top3[1].name}
                </p>
                <p className="text-sm font-mono text-[var(--text-secondary)]">
                  {top3[1].score.toLocaleString()}
                </p>
              </div>
              <div className="w-full h-16 bg-gray-400/20 rounded-t-lg mt-2" />
            </div>
          )}

          {/* 1st place */}
          {top3[0] && (
            <div className="flex flex-col items-center scale-in">
              <div className={`glass-card p-5 text-center w-28 sm:w-32 ${participantId === top3[0].participantId ? "ring-2 ring-[var(--color-action)]" : ""}`}>
                {getRankIcon(1)}
                <p className="font-bold text-[var(--text-primary)] mt-2 truncate">
                  {top3[0].name}
                </p>
                <p className="text-lg font-mono font-bold text-[var(--text-primary)]">
                  {top3[0].score.toLocaleString()}
                </p>
              </div>
              <div className="w-full h-24 bg-[#F59E0B]/30 rounded-t-lg mt-2" />
            </div>
          )}

          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center scale-in" style={{ animationDelay: "0.2s" }}>
              <div className="glass-card p-4 text-center w-24 sm:w-28">
                {getRankIcon(3)}
                <p className="font-semibold text-[var(--text-primary)] mt-2 truncate">
                  {top3[2].name}
                </p>
                <p className="text-sm font-mono text-[var(--text-secondary)]">
                  {top3[2].score.toLocaleString()}
                </p>
              </div>
              <div className="w-full h-12 bg-amber-700/20 rounded-t-lg mt-2" />
            </div>
          )}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="glass-card p-4 mb-8">
          <div className="space-y-2">
            {rest.map((entry) => (
              <div
                key={entry.participantId}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.participantId === participantId
                    ? "bg-white/10 border-l-4 border-[var(--color-action)]"
                    : "bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                    {entry.rank}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-[var(--text-secondary)]">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isHost && (
          <Button variant="secondary" onClick={handleDownload} className="flex-1">
            <Download className="w-5 h-5 mr-2" />
            Download Results
          </Button>
        )}
        <Button variant="primary" onClick={handlePlayAgain} className="flex-1">
          <Home className="w-5 h-5 mr-2" />
          Play Again
        </Button>
      </div>
    </div>
  );
}
