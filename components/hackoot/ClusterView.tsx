"use client";

import { TeamAnswerCluster } from "@/types";

interface ClusterViewProps {
  clusters: TeamAnswerCluster[];
  title?: string;
  maxItems?: number;
}

export function ClusterView({
  clusters,
  title = "Grouped answers",
  maxItems = 10,
}: ClusterViewProps) {
  const displayClusters = clusters.slice(0, maxItems);

  return (
    <div className="glass-card p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      {displayClusters.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No responses to group yet.</p>
      ) : (
        <div className="space-y-2">
          {displayClusters.map((cluster) => (
            <div
              key={cluster.id}
              className="flex items-center justify-between text-sm bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2"
            >
              <span className="text-[var(--text-primary)]">{cluster.canonicalText}</span>
              <span className="text-[var(--text-secondary)]">{cluster.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
