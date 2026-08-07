import { Participant, TeamAnswerCluster } from "@/types";

export interface SharedSubject {
  questionId: string;
  questionText: string;
  topic: string;
  participantCount: number;
}

export interface ParticipantMatch {
  participantId: string;
  score: number;
  sharedSubjects: SharedSubject[];
}

export interface InterestMatchNode {
  participantId: string;
  name: string;
  matches: ParticipantMatch[];
}

export interface InterestMatchGraphData {
  participants: InterestMatchNode[];
  maxScore: number;
}

interface MatchEdge {
  leftParticipantId: string;
  rightParticipantId: string;
  subjects: Map<string, SharedSubject>;
}

function makePairKey(leftParticipantId: string, rightParticipantId: string): string {
  return leftParticipantId < rightParticipantId
    ? `${leftParticipantId}|${rightParticipantId}`
    : `${rightParticipantId}|${leftParticipantId}`;
}

function makeSubjectKey(questionId: string, topic: string): string {
  return `${questionId}::${topic.toLowerCase()}`;
}

export function buildInterestMatchGraph(
  participants: Participant[],
  clustersByQuestion: Record<string, TeamAnswerCluster[]> | undefined,
  questionPrompts: Record<string, string> | undefined
): InterestMatchGraphData {
  const participantLookup = new Map(participants.map((participant) => [participant.participantId, participant]));
  const edges = new Map<string, MatchEdge>();

  const safeClusters = clustersByQuestion ?? {};
  const safePrompts = questionPrompts ?? {};

  for (const [questionId, clusters] of Object.entries(safeClusters)) {
    const questionText = safePrompts[questionId]?.trim() || "Shared topic";

    for (const cluster of clusters) {
      const uniqueParticipants = Array.from(
        new Set(cluster.participantIds.filter((participantId) => participantLookup.has(participantId)))
      );

      if (uniqueParticipants.length < 2) {
        continue;
      }

      const topic = cluster.canonicalText.trim() || "similar response";

      for (let index = 0; index < uniqueParticipants.length - 1; index += 1) {
        for (let peerIndex = index + 1; peerIndex < uniqueParticipants.length; peerIndex += 1) {
          const leftParticipantId = uniqueParticipants[index];
          const rightParticipantId = uniqueParticipants[peerIndex];
          const edgeKey = makePairKey(leftParticipantId, rightParticipantId);

          const edge =
            edges.get(edgeKey) ??
            {
              leftParticipantId,
              rightParticipantId,
              subjects: new Map<string, SharedSubject>(),
            };

          edge.subjects.set(makeSubjectKey(questionId, topic), {
            questionId,
            questionText,
            topic,
            participantCount: uniqueParticipants.length,
          });

          edges.set(edgeKey, edge);
        }
      }
    }
  }

  const matchesByParticipant = new Map<string, Map<string, ParticipantMatch>>();

  for (const participant of participants) {
    matchesByParticipant.set(participant.participantId, new Map<string, ParticipantMatch>());
  }

  let maxScore = 0;

  for (const edge of edges.values()) {
    const sharedSubjects = Array.from(edge.subjects.values()).sort((left, right) => {
      if (left.questionText === right.questionText) {
        return left.topic.localeCompare(right.topic);
      }
      return left.questionText.localeCompare(right.questionText);
    });

    const score = sharedSubjects.length;
    maxScore = Math.max(maxScore, score);

    const leftMatches = matchesByParticipant.get(edge.leftParticipantId);
    const rightMatches = matchesByParticipant.get(edge.rightParticipantId);

    if (leftMatches) {
      leftMatches.set(edge.rightParticipantId, {
        participantId: edge.rightParticipantId,
        score,
        sharedSubjects,
      });
    }

    if (rightMatches) {
      rightMatches.set(edge.leftParticipantId, {
        participantId: edge.leftParticipantId,
        score,
        sharedSubjects,
      });
    }
  }

  const resultParticipants: InterestMatchNode[] = participants.map((participant) => {
    const participantMatches = matchesByParticipant.get(participant.participantId);

    const matches = Array.from(participantMatches?.values() ?? []).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftName = participantLookup.get(left.participantId)?.name ?? "";
      const rightName = participantLookup.get(right.participantId)?.name ?? "";
      return leftName.localeCompare(rightName);
    });

    return {
      participantId: participant.participantId,
      name: participant.name,
      matches,
    };
  });

  return {
    participants: resultParticipants,
    maxScore,
  };
}
