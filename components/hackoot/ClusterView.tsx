"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { TeamAnswerCluster } from "@/types";
import { X } from "lucide-react";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantAvatarStack } from "./ParticipantAvatarStack";
import {
  publishParticipantListOverlayOpen,
  subscribeToParticipantListOverlayOpen,
} from "./participantListOverlayBus";

interface ClusterParticipant {
  participantId: string;
  name: string;
}

interface ActiveParticipantList {
  clusterId: string;
  clusterText: string;
  participants: ClusterParticipant[];
}

interface ClusterViewProps {
  clusters: TeamAnswerCluster[];
  title?: string;
  maxItems?: number;
  participants?: ClusterParticipant[];
  showParticipantAvatars?: boolean;
  maxInlineAvatars?: number;
  enableParticipantList?: boolean;
}

export function ClusterView({
  clusters,
  title = "Grouped answers",
  maxItems = 10,
  participants = [],
  showParticipantAvatars = false,
  maxInlineAvatars = 4,
  enableParticipantList = true,
}: ClusterViewProps) {
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.participantId, participant])),
    [participants]
  );

  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const hasMoreAnswers = clusters.length > maxItems;
  const displayClusters = showAllAnswers ? clusters : clusters.slice(0, maxItems);
  const overlayOwnerId = useId();
  const [activeParticipantList, setActiveParticipantList] = useState<ActiveParticipantList | null>(null);

  useEffect(
    () => subscribeToParticipantListOverlayOpen(overlayOwnerId, () => setActiveParticipantList(null)),
    [overlayOwnerId]
  );

  const openParticipantList = (cluster: TeamAnswerCluster) => {
    if (!showParticipantAvatars || !enableParticipantList) {
      return;
    }

    const clusterParticipants = cluster.participantIds
      .map((participantId) => participantById.get(participantId))
      .filter((participant): participant is ClusterParticipant => participant !== undefined);

    if (clusterParticipants.length === 0) {
      return;
    }

    publishParticipantListOverlayOpen(overlayOwnerId);
    setActiveParticipantList({
      clusterId: cluster.id,
      clusterText: cluster.canonicalText,
      participants: clusterParticipants,
    });
  };

  return (
    <div className="glass-card p-5 relative">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      {displayClusters.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No responses to group yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {displayClusters.map((cluster) => {
              const clusterParticipants = cluster.participantIds
                .map((participantId) => participantById.get(participantId))
                .filter((participant): participant is ClusterParticipant => participant !== undefined);
              const canOpenParticipantList =
                showParticipantAvatars &&
                enableParticipantList &&
                clusterParticipants.length > 0;
              const groupedVariants = (cluster.answerTexts ?? []).filter(
                (answerText) => answerText !== cluster.canonicalText
              );

              return (
                <div
                  key={cluster.id}
                  className={cn(
                    "flex items-center justify-between gap-3 text-sm bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2",
                    canOpenParticipantList && "cursor-pointer hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]/50"
                  )}
                  role={canOpenParticipantList ? "button" : undefined}
                  tabIndex={canOpenParticipantList ? 0 : undefined}
                  onClick={canOpenParticipantList ? () => openParticipantList(cluster) : undefined}
                  onKeyDown={canOpenParticipantList
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openParticipantList(cluster);
                        }
                      }
                    : undefined}
                  aria-label={canOpenParticipantList ? `View participants for ${cluster.canonicalText}` : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] break-words">{cluster.canonicalText}</p>
                    {groupedVariants.length > 0 && (
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                        Also grouped: {groupedVariants.join(", ")}
                      </p>
                    )}
                  </div>

                  {showParticipantAvatars ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <ParticipantAvatarStack
                        participantIds={cluster.participantIds}
                        participants={participants}
                        maxVisible={maxInlineAvatars}
                      />
                      <span className="text-[var(--text-secondary)]">{cluster.count}</span>
                    </div>
                  ) : (
                    <span className="text-[var(--text-secondary)]">{cluster.count}</span>
                  )}
                </div>
              );
            })}
          </div>

          {hasMoreAnswers && (
            <button
              type="button"
              onClick={() => setShowAllAnswers((current) => !current)}
              className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showAllAnswers
                ? "See fewer answers"
                : `See more answers (${clusters.length - maxItems} more)`}
            </button>
          )}
        </>
      )}

      {activeParticipantList && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#120A2A]/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Participants for response</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-words">
                {activeParticipantList.clusterText}
              </p>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              onClick={() => setActiveParticipantList(null)}
              aria-label="Close participant list"
            >
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {activeParticipantList.participants.map((participant) => (
              <div
                key={`${activeParticipantList.clusterId}-${participant.participantId}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
              >
                <ParticipantAvatar participantId={participant.participantId} name={participant.name} size="sm" />
                <span className="text-sm text-[var(--text-primary)]">{participant.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
