import { useEffect, useId, useMemo, useState } from "react";
import { DiscussionQueueItem } from "@/types";
import { MessageCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParticipantAvatarStack } from "./ParticipantAvatarStack";
import { ParticipantAvatar } from "./ParticipantAvatar";
import {
  publishParticipantListOverlayOpen,
  subscribeToParticipantListOverlayOpen,
} from "./participantListOverlayBus";

interface DiscussionParticipant {
  participantId: string;
  name: string;
}

interface ActiveParticipantList {
  itemId: string;
  itemText: string;
  participants: DiscussionParticipant[];
}

interface DiscussionResultsPanelProps {
  items: DiscussionQueueItem[];
  topCount?: number;
  title?: string;
  participants?: DiscussionParticipant[];
  maxInlineAvatars?: number;
  enableParticipantList?: boolean;
}

export function DiscussionResultsPanel({
  items,
  topCount = 3,
  title = "Discussion focus",
  participants = [],
  maxInlineAvatars = 4,
  enableParticipantList = false,
}: DiscussionResultsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const overlayOwnerId = useId();
  const [activeParticipantList, setActiveParticipantList] = useState<ActiveParticipantList | null>(null);

  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.participantId, participant])),
    [participants]
  );

  useEffect(
    () => subscribeToParticipantListOverlayOpen(overlayOwnerId, () => setActiveParticipantList(null)),
    [overlayOwnerId]
  );

  const topItems = useMemo(() => {
    const positivelyVoted = items.filter((item) => item.voteCount > 0);
    if (positivelyVoted.length > 0) {
      return positivelyVoted.slice(0, topCount);
    }
    return items.slice(0, topCount);
  }, [items, topCount]);

  const openParticipantList = (item: DiscussionQueueItem) => {
    if (!enableParticipantList) {
      return;
    }

    const voterIds = item.voterParticipantIds?.length
      ? item.voterParticipantIds
      : item.participantIds;

    const itemParticipants = voterIds
      .map((participantId) => participantById.get(participantId))
      .filter((participant): participant is DiscussionParticipant => participant !== undefined);

    if (itemParticipants.length === 0) {
      return;
    }

    publishParticipantListOverlayOpen(overlayOwnerId);
    setActiveParticipantList({
      itemId: item.id,
      itemText: item.text,
      participants: itemParticipants,
    });
  };

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
              {topItems.map((item, index) => {
                const voterIds = item.voterParticipantIds?.length
                  ? item.voterParticipantIds
                  : item.participantIds;
                const hasParticipants = voterIds.length > 0;
                const canOpenParticipantList = enableParticipantList && hasParticipants;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between text-sm rounded-lg border border-[var(--color-action)]/25 bg-[var(--color-action)]/10 px-3 py-2",
                      canOpenParticipantList && "cursor-pointer hover:bg-[var(--color-action)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]/60"
                    )}
                    role={canOpenParticipantList ? "button" : undefined}
                    tabIndex={canOpenParticipantList ? 0 : undefined}
                    onClick={canOpenParticipantList ? () => openParticipantList(item) : undefined}
                    onKeyDown={canOpenParticipantList
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openParticipantList(item);
                          }
                        }
                      : undefined}
                    aria-label={canOpenParticipantList ? `View participants for ${item.text}` : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--text-primary)]/80 w-6">{index + 1}.</span>
                      <span className="text-[var(--text-primary)] break-words">{item.text}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ParticipantAvatarStack
                        participantIds={voterIds}
                        participants={participants}
                        maxVisible={maxInlineAvatars}
                      />
                      <span className="text-[var(--text-primary)]/90">
                        {item.voteCount} vote{item.voteCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
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
              {items.map((item, index) => {
                const voterIds = item.voterParticipantIds?.length
                  ? item.voterParticipantIds
                  : item.participantIds;
                const hasParticipants = voterIds.length > 0;
                const canOpenParticipantList = enableParticipantList && hasParticipants;

                return (
                  <div
                    key={`${item.id}-all`}
                    className={cn(
                      "flex items-center justify-between text-sm bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2",
                      canOpenParticipantList && "cursor-pointer hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]/50"
                    )}
                    role={canOpenParticipantList ? "button" : undefined}
                    tabIndex={canOpenParticipantList ? 0 : undefined}
                    onClick={canOpenParticipantList ? () => openParticipantList(item) : undefined}
                    onKeyDown={canOpenParticipantList
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openParticipantList(item);
                          }
                        }
                      : undefined}
                    aria-label={canOpenParticipantList ? `View participants for ${item.text}` : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--text-secondary)] w-6">{index + 1}.</span>
                      <span className="text-[var(--text-primary)] break-words">{item.text}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ParticipantAvatarStack
                        participantIds={voterIds}
                        participants={participants}
                        maxVisible={maxInlineAvatars}
                      />
                      <span className="text-[var(--text-secondary)]">
                        {item.voteCount} vote{item.voteCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeParticipantList && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#120A2A]/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Voters for response</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-words">
                {activeParticipantList.itemText}
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
                key={`${activeParticipantList.itemId}-${participant.participantId}`}
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
