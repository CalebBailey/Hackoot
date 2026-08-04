import { useEffect, useMemo, useState } from "react";
import { Participant, TeamAnswerCluster } from "@/types";
import {
  buildInterestMatchGraph,
  InterestMatchNode,
  ParticipantMatch,
} from "@/utils/teamBuilding";
import { Network } from "lucide-react";

interface InterestMatchGraphProps {
  participants: Participant[];
  clustersByQuestion?: Record<string, TeamAnswerCluster[]>;
  questionPrompts?: Record<string, string>;
  currentParticipantId?: string | null;
  title?: string;
  maxVisibleMatches?: number;
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function toNodePositions(matches: ParticipantMatch[]) {
  const centreX = 320;
  const centreY = 170;
  const radius = matches.length <= 2 ? 130 : 155;

  return matches.map((match, index) => {
    const angle = (-Math.PI / 2) + (2 * Math.PI * index) / Math.max(1, matches.length);

    return {
      match,
      x: centreX + Math.cos(angle) * radius,
      y: centreY + Math.sin(angle) * radius,
    };
  });
}

export function InterestMatchGraph({
  participants,
  clustersByQuestion,
  questionPrompts,
  currentParticipantId,
  title = "Compatibility graph",
  maxVisibleMatches = 6,
}: InterestMatchGraphProps) {
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.participantId, participant])),
    [participants]
  );

  const graph = useMemo(
    () => buildInterestMatchGraph(participants, clustersByQuestion, questionPrompts),
    [participants, clustersByQuestion, questionPrompts]
  );

  const [focusParticipantId, setFocusParticipantId] = useState<string>(
    currentParticipantId ?? participants[0]?.participantId ?? ""
  );

  useEffect(() => {
    const fallbackParticipantId = currentParticipantId ?? participants[0]?.participantId ?? "";

    if (!focusParticipantId) {
      setFocusParticipantId(fallbackParticipantId);
      return;
    }

    if (!participantById.has(focusParticipantId)) {
      setFocusParticipantId(fallbackParticipantId);
    }
  }, [currentParticipantId, focusParticipantId, participantById, participants]);

  const focusNode: InterestMatchNode | undefined = graph.participants.find(
    (participant) => participant.participantId === focusParticipantId
  );

  const visibleMatches = useMemo(
    () => (focusNode?.matches ?? []).slice(0, maxVisibleMatches),
    [focusNode?.matches, maxVisibleMatches]
  );

  const maxScore = Math.max(1, graph.maxScore);
  const hasConnections = visibleMatches.length > 0;
  const positions = toNodePositions(visibleMatches);
  const focusLabel = currentParticipantId && currentParticipantId === focusNode?.participantId ? "You" : "Focus";

  return (
    <div className="glass-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-[var(--color-action)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>

        {participants.length > 1 && (
          <label className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
            Focus person
            <select
              value={focusParticipantId}
              onChange={(event) => setFocusParticipantId(event.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[var(--text-primary)]"
            >
              {participants.map((participant) => (
                <option key={participant.participantId} value={participant.participantId}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!focusNode ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No participant data available yet.
        </p>
      ) : !hasConnections ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Not enough overlapping answers yet to build a compatibility graph.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 overflow-x-auto">
            <svg viewBox="0 0 640 360" className="w-full min-w-[540px] h-auto" role="img" aria-label="Compatibility graph">
              {positions.map(({ match, x, y }) => {
                const strokeWidth = 1.5 + (match.score / maxScore) * 4;
                const midX = (320 + x) / 2;
                const midY = (170 + y) / 2;

                return (
                  <g key={match.participantId}>
                    <line
                      x1={320}
                      y1={170}
                      x2={x}
                      y2={y}
                      stroke="var(--color-action)"
                      strokeOpacity={0.65}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <circle cx={midX} cy={midY} r={12} fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255, 255, 255, 0.2)" />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      className="fill-[var(--text-primary)] text-[10px] font-semibold"
                    >
                      {match.score}
                    </text>
                  </g>
                );
              })}

              <circle
                cx={320}
                cy={170}
                r={38}
                fill="var(--color-action)"
                fillOpacity={0.22}
                stroke="var(--color-action)"
              />
              <text
                x={320}
                y={164}
                textAnchor="middle"
                className="fill-[var(--text-primary)] text-sm font-semibold"
              >
                {truncateLabel(focusNode.name, 16)}
              </text>
              <text
                x={320}
                y={182}
                textAnchor="middle"
                className="fill-[var(--text-secondary)] text-[11px]"
              >
                {focusLabel}
              </text>

              {positions.map(({ match, x, y }) => {
                const name = participantById.get(match.participantId)?.name ?? "Participant";

                return (
                  <g key={`${match.participantId}-node`}>
                    <circle cx={x} cy={y} r={28} fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.2)" />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      className="fill-[var(--text-primary)] text-[11px] font-medium"
                    >
                      {truncateLabel(name, 14)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-4 space-y-3">
            {visibleMatches.map((match) => {
              const name = participantById.get(match.participantId)?.name ?? "Participant";

              return (
                <div key={match.participantId} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--text-primary)]">{name}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-action)]/20 text-[var(--text-primary)] border border-[var(--color-action)]/35">
                      {match.score} shared subject{match.score === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {match.sharedSubjects.slice(0, 6).map((subject) => (
                      <span
                        key={`${match.participantId}-${subject.questionId}-${subject.topic}`}
                        title={`${subject.questionText}: ${subject.topic}`}
                        className="text-xs px-2 py-1 rounded-md border border-white/10 bg-black/20 text-[var(--text-secondary)]"
                      >
                        <span className="text-[var(--text-primary)]">{truncateLabel(subject.questionText, 34)}</span>
                        {" - "}
                        {truncateLabel(subject.topic, 24)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
