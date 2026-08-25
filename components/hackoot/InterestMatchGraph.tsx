import { useEffect, useMemo, useState } from "react";
import { Participant, TeamAnswerCluster } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";
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

interface GraphLayout {
  width: number;
  height: number;
  centreX: number;
  centreY: number;
  radius: number;
  focusRadius: number;
  outerNodeRadius: number;
  scoreBadgeRadius: number;
  focusLabelMaxLength: number;
  nodeLabelMaxLength: number;
}

function createGraphLayout(matchCount: number, isMobile: boolean): GraphLayout {
  if (isMobile) {
    return {
      width: 380,
      height: 420,
      centreX: 190,
      centreY: 190,
      radius: matchCount <= 2 ? 118 : 134,
      focusRadius: 44,
      outerNodeRadius: 26,
      scoreBadgeRadius: 11,
      focusLabelMaxLength: 13,
      nodeLabelMaxLength: 10,
    };
  }

  return {
    width: 640,
    height: 360,
    centreX: 320,
    centreY: 170,
    radius: matchCount <= 2 ? 130 : 155,
    focusRadius: 38,
    outerNodeRadius: 28,
    scoreBadgeRadius: 12,
    focusLabelMaxLength: 16,
    nodeLabelMaxLength: 14,
  };
}

function toNodePositions(matches: ParticipantMatch[], layout: GraphLayout) {
  const { centreX, centreY, radius } = layout;

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
  const isMobile = useIsMobile();

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
  const layout = useMemo(
    () => createGraphLayout(visibleMatches.length, isMobile),
    [visibleMatches.length, isMobile]
  );
  const positions = useMemo(
    () => toNodePositions(visibleMatches, layout),
    [visibleMatches, layout]
  );
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
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 overflow-hidden">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="w-full h-auto"
              role="img"
              aria-label="Compatibility graph"
            >
              {positions.map(({ match, x, y }) => {
                const strokeWidth = 1.5 + (match.score / maxScore) * 4;
                const midX = (layout.centreX + x) / 2;
                const midY = (layout.centreY + y) / 2;

                return (
                  <g key={match.participantId}>
                    <line
                      x1={layout.centreX}
                      y1={layout.centreY}
                      x2={x}
                      y2={y}
                      stroke="var(--color-action)"
                      strokeOpacity={0.65}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={midX}
                      cy={midY}
                      r={layout.scoreBadgeRadius}
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke="rgba(255, 255, 255, 0.2)"
                    />
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
                cx={layout.centreX}
                cy={layout.centreY}
                r={layout.focusRadius}
                fill="var(--color-action)"
                fillOpacity={0.22}
                stroke="var(--color-action)"
              />
              <text
                x={layout.centreX}
                y={layout.centreY - 6}
                textAnchor="middle"
                className="fill-[var(--text-primary)] text-sm font-semibold"
              >
                {truncateLabel(focusNode.name, layout.focusLabelMaxLength)}
              </text>
              <text
                x={layout.centreX}
                y={layout.centreY + 12}
                textAnchor="middle"
                className="fill-[var(--text-secondary)] text-[11px]"
              >
                {focusLabel}
              </text>

              {positions.map(({ match, x, y }) => {
                const name = participantById.get(match.participantId)?.name ?? "Participant";

                return (
                  <g key={`${match.participantId}-node`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={layout.outerNodeRadius}
                      fill="rgba(255, 255, 255, 0.06)"
                      stroke="rgba(255, 255, 255, 0.2)"
                    />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      className="fill-[var(--text-primary)] text-[11px] font-medium"
                    >
                      {truncateLabel(name, layout.nodeLabelMaxLength)}
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]/80 mt-1">In common</p>
                    </div>
                    <div className="text-right rounded-lg border border-[var(--color-action)]/40 bg-[var(--color-action)]/18 px-3 py-2 min-w-[88px]">
                      <p className="text-2xl font-black leading-none text-[var(--text-primary)]">{match.score}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-primary)]/85">
                        shared point{match.score === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {match.sharedSubjects.slice(0, 6).map((subject) => (
                      <div
                        key={`${match.participantId}-${subject.questionId}-${subject.topic}`}
                        title={`${subject.questionText}: ${subject.topic}`}
                        className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {truncateLabel(subject.topic, 34)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]/75 mt-0.5">
                          {truncateLabel(subject.questionText, 70)}
                        </p>
                      </div>
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
