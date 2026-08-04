import { TeamAnswerCluster } from "@/types";
import { normaliseAnswer, NormaliseOptions } from "./normalise";

export interface RawTeamAnswer {
  answerId: string;
  participantId: string;
  text: string;
}

export interface GroupAnswersResult {
  clusters: TeamAnswerCluster[];
  unresolved: RawTeamAnswer[];
}

export function groupAnswersByNormalisedText(
  answers: RawTeamAnswer[],
  options: NormaliseOptions = {}
): GroupAnswersResult {
  const buckets = new Map<string, RawTeamAnswer[]>();
  const unresolved: RawTeamAnswer[] = [];

  for (const answer of answers) {
    const key = normaliseAnswer(answer.text, options);
    if (!key) {
      unresolved.push(answer);
      continue;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.push(answer);
    } else {
      buckets.set(key, [answer]);
    }
  }

  const clusters: TeamAnswerCluster[] = Array.from(buckets.entries())
    .map(([canonicalText, groupedAnswers], index) => {
      const participantIds = Array.from(new Set(groupedAnswers.map((a) => a.participantId)));
      return {
        id: `cluster-${index + 1}`,
        canonicalText,
        answerIds: groupedAnswers.map((a) => a.answerId),
        participantIds,
        count: groupedAnswers.length,
      };
    })
    .sort((a, b) => b.count - a.count || a.canonicalText.localeCompare(b.canonicalText));

  return {
    clusters,
    unresolved,
  };
}
