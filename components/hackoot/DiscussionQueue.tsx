"use client";

import { DiscussionQueueItem } from "@/types";

interface DiscussionQueueProps {
  items: DiscussionQueueItem[];
  title?: string;
  maxItems?: number;
}

export function DiscussionQueue({
  items,
  title = "Discussion queue",
  maxItems = 10,
}: DiscussionQueueProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="glass-card p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      {displayItems.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No discussion items available.</p>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item, index) => (
            <div
              key={item.id}
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
    </div>
  );
}
