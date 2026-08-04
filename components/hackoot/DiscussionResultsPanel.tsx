import { useMemo, useState } from "react";
import { DiscussionQueueItem } from "@/types";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

interface DiscussionResultsPanelProps {
  items: DiscussionQueueItem[];
  topCount?: number;
  title?: string;
}

function formatVoteShare(voteShare: number): string {
  return `${Math.round(voteShare * 100)}%`;
}

export function DiscussionResultsPanel({
  items,
  topCount = 3,
  title = "Discussion focus",
}: DiscussionResultsPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const topItems = useMemo(() => {
    const positivelyVoted = items.filter((item) => item.voteCount > 0);
    if (positivelyVoted.length > 0) {
      return positivelyVoted.slice(0, topCount);
    }
    return items.slice(0, topCount);
  }, [items, topCount]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-5 h-5 text-[var(--color-action)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No answers available for discussion.</p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Top selected answers</p>
            <div className="space-y-2">
              {topItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm rounded-lg border border-[var(--color-action)]/25 bg-[var(--color-action)]/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-primary)]/80 w-6">{index + 1}.</span>
                    <span className="text-[var(--text-primary)]">{item.text}</span>
                  </div>
                  <span className="text-[var(--text-primary)]/90">
                    {item.voteCount} vote{item.voteCount === 1 ? "" : "s"} ({formatVoteShare(item.voteShare)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAll ? "Hide all answers" : `Show all answers (${items.length})`}
          </button>

          {showAll && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div
                  key={`${item.id}-all`}
                  className="flex items-center justify-between text-sm bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)] w-6">{index + 1}.</span>
                    <span className="text-[var(--text-primary)]">{item.text}</span>
                  </div>
                  <span className="text-[var(--text-secondary)]">
                    {item.voteCount} vote{item.voteCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
