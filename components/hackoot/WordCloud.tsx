"use client";

import { WordCloudTerm } from "@/types";
import { Sparkles } from "lucide-react";

interface WordCloudProps {
  terms: WordCloudTerm[];
  title?: string;
  maxItems?: number;
}

export function WordCloud({
  terms,
  title = "Word cloud terms",
  maxItems = 20,
}: WordCloudProps) {
  const displayTerms = terms.slice(0, maxItems);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-[var(--color-action)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>

      {displayTerms.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No terms available yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {displayTerms.map((term) => (
            <span
              key={term.text}
              className="px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-100"
              style={{ fontSize: `${Math.min(20, 12 + term.weight * 2)}px` }}
            >
              {term.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
