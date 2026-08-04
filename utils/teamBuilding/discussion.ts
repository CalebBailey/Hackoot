import { DiscussionQueueItem, DiscussionVoteCandidate } from "@/types";

export interface RawVoteRecord {
  participantId: string;
  answerIds: string[];
}

export function buildDiscussionQueue(
  candidates: DiscussionVoteCandidate[],
  votes: RawVoteRecord[]
): DiscussionQueueItem[] {
  const totals = new Map<string, number>();
  const totalVotes = votes.reduce((sum, record) => sum + record.answerIds.length, 0);

  for (const vote of votes) {
    for (const answerId of vote.answerIds) {
      totals.set(answerId, (totals.get(answerId) ?? 0) + 1);
    }
  }

  return candidates
    .map((candidate) => {
      const voteCount = totals.get(candidate.id) ?? 0;
      const participantIds = candidate.participantId ? [candidate.participantId] : [];
      return {
        id: candidate.id,
        text: candidate.text,
        participantIds,
        voteCount,
        voteShare: totalVotes > 0 ? voteCount / totalVotes : 0,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount || a.text.localeCompare(b.text));
}
