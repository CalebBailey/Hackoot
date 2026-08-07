import { useMemo } from "react";
import { ParticipantAvatar } from "./ParticipantAvatar";

interface ParticipantSummary {
  participantId: string;
  name: string;
}

interface ParticipantAvatarStackProps {
  participantIds: string[];
  participants: ParticipantSummary[];
  maxVisible?: number;
}

export function ParticipantAvatarStack({
  participantIds,
  participants,
  maxVisible = 4,
}: ParticipantAvatarStackProps) {
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.participantId, participant])),
    [participants]
  );

  const uniqueParticipants = useMemo(() => {
    const uniqueIds = Array.from(new Set(participantIds));

    return uniqueIds
      .map((participantId) => participantById.get(participantId))
      .filter((participant): participant is ParticipantSummary => participant !== undefined);
  }, [participantById, participantIds]);

  if (uniqueParticipants.length === 0) {
    return null;
  }

  const visibleParticipants = uniqueParticipants.slice(0, maxVisible);
  const overflowCount = Math.max(0, uniqueParticipants.length - visibleParticipants.length);

  return (
    <div className="flex -space-x-2">
      {visibleParticipants.map((participant) => (
        <ParticipantAvatar
          key={participant.participantId}
          participantId={participant.participantId}
          name={participant.name}
          size="sm"
          className="ring-2 ring-[#0D0118]"
        />
      ))}

      {overflowCount > 0 && (
        <div
          className="h-7 w-7 rounded-full border border-white/25 bg-white/10 text-[10px] font-bold text-[var(--text-primary)] inline-flex items-center justify-center ring-2 ring-[#0D0118]"
          title={`${overflowCount} more participant${overflowCount === 1 ? "" : "s"}`}
          aria-label={`${overflowCount} more participants`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
