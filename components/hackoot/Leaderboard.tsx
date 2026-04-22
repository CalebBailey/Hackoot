"use client";

import { LeaderboardEntry } from "@/types";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

// Height of each row in px (padding + content + gap)
const ROW_HEIGHT = 52;

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightId?: string;
  maxEntries?: number;
}

export function Leaderboard({ entries, highlightId, maxEntries }: LeaderboardProps) {
  const displayEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

  return (
    <div
      className="glass-card p-4 sm:p-6 w-full max-w-md"
      role="table"
      aria-label="Leaderboard"
      aria-live="polite"
    >
      <h3 className="text-xl font-heading font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-[#F59E0B]" />
        Leaderboard
      </h3>

      {displayEntries.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-4">
          No participants yet
        </p>
      ) : (
        <div
          className="relative"
          style={{ height: displayEntries.length * ROW_HEIGHT }}
        >
          {displayEntries.map((entry, index) => {
            const isHighlighted = entry.participantId === highlightId;
            const isTop3 = entry.rank <= 3;

            return (
              <div
                key={entry.participantId}
                className={cn(
                  "absolute left-0 right-0 flex items-center justify-between px-3 py-2.5 rounded-lg",
                  "transition-[top] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isHighlighted
                    ? "border-l-4 border-[var(--color-action)] bg-white/5"
                    : "bg-white/[0.03]"
                )}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT - 4 }}
                role="row"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                      entry.rank === 1 && "bg-[#F59E0B] text-white",
                      entry.rank === 2 && "bg-gray-400 text-white",
                      entry.rank === 3 && "bg-amber-700 text-white",
                      entry.rank > 3 && "bg-white/10 text-[var(--text-secondary)]"
                    )}
                  >
                    {entry.rank}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      isHighlighted
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {entry.name}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-bold font-mono",
                    isTop3 ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                  )}
                >
                  {entry.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
