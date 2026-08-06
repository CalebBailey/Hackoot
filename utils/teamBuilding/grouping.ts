import { TeamAnswerCluster } from "@/types";
import { normaliseAnswer, NormaliseOptions } from "./normalise";

const PHRASE_MATCH_THRESHOLD = 0.65;
const MIN_SHARED_TOKENS = 2;
const TOKEN_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
]);

export interface RawTeamAnswer {
  answerId: string;
  participantId: string;
  text: string;
}

export interface GroupAnswersResult {
  clusters: TeamAnswerCluster[];
  unresolved: RawTeamAnswer[];
}

interface ClusterBucket {
  canonicalText: string;
  groupedAnswers: RawTeamAnswer[];
  participantIds: Set<string>;
  tokenSet: Set<string>;
}

function stemToken(token: string): string {
  if (token.length > 4 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }

  if (token.length > 3 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (token.length > 2 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}

function buildTokenSet(text: string, options: NormaliseOptions): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .split(/\s+/)
    .map((token) => normaliseAnswer(token, options))
    .map((token) => stemToken(token))
    .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token));

  return new Set(tokens);
}

function scoreTokenSimilarity(
  left: Set<string>,
  right: Set<string>
): { score: number; sharedTokenCount: number } {
  if (left.size === 0 || right.size === 0) {
    return { score: 0, sharedTokenCount: 0 };
  }

  let sharedTokenCount = 0;
  for (const token of left) {
    if (right.has(token)) {
      sharedTokenCount += 1;
    }
  }

  if (sharedTokenCount === 0) {
    return { score: 0, sharedTokenCount: 0 };
  }

  const smallerSize = Math.min(left.size, right.size);
  const unionSize = left.size + right.size - sharedTokenCount;
  const coverage = sharedTokenCount / smallerSize;
  const jaccard = unionSize > 0 ? sharedTokenCount / unionSize : 0;

  return {
    score: coverage * 0.75 + jaccard * 0.25,
    sharedTokenCount,
  };
}

function findSimilarBucket(tokens: Set<string>, buckets: ClusterBucket[]): ClusterBucket | null {
  if (tokens.size < MIN_SHARED_TOKENS) {
    return null;
  }

  let bestMatch: { bucket: ClusterBucket; score: number } | null = null;

  for (const bucket of buckets) {
    if (bucket.tokenSet.size < MIN_SHARED_TOKENS) {
      continue;
    }

    const { score, sharedTokenCount } = scoreTokenSimilarity(tokens, bucket.tokenSet);
    if (sharedTokenCount < MIN_SHARED_TOKENS || score < PHRASE_MATCH_THRESHOLD) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { bucket, score };
    }
  }

  return bestMatch?.bucket ?? null;
}

function addAnswerToBucket(bucket: ClusterBucket, answer: RawTeamAnswer, tokens: Set<string>): void {
  bucket.groupedAnswers.push(answer);
  bucket.participantIds.add(answer.participantId);

  for (const token of tokens) {
    bucket.tokenSet.add(token);
  }
}

export function groupAnswersByNormalisedText(
  answers: RawTeamAnswer[],
  options: NormaliseOptions = {}
): GroupAnswersResult {
  const bucketsByCanonicalText = new Map<string, ClusterBucket>();
  const buckets: ClusterBucket[] = [];
  const unresolved: RawTeamAnswer[] = [];

  for (const answer of answers) {
    const key = normaliseAnswer(answer.text, options);
    if (!key) {
      unresolved.push(answer);
      continue;
    }

    const answerTokens = buildTokenSet(answer.text, options);

    const existingBucket = bucketsByCanonicalText.get(key);
    if (existingBucket) {
      addAnswerToBucket(existingBucket, answer, answerTokens);
      continue;
    }

    const similarBucket = findSimilarBucket(answerTokens, buckets);
    if (similarBucket) {
      addAnswerToBucket(similarBucket, answer, answerTokens);
      bucketsByCanonicalText.set(key, similarBucket);
      continue;
    }

    const newBucket: ClusterBucket = {
      canonicalText: key,
      groupedAnswers: [answer],
      participantIds: new Set([answer.participantId]),
      tokenSet: answerTokens,
    };

    buckets.push(newBucket);
    bucketsByCanonicalText.set(key, newBucket);
  }

  const clusters: TeamAnswerCluster[] = buckets
    .map((bucket, index) => {
      return {
        id: `cluster-${index + 1}`,
        canonicalText: bucket.canonicalText,
        answerIds: bucket.groupedAnswers.map((entry) => entry.answerId),
        participantIds: Array.from(bucket.participantIds),
        count: bucket.groupedAnswers.length,
      };
    })
    .sort((a, b) => b.count - a.count || a.canonicalText.localeCompare(b.canonicalText));

  return {
    clusters,
    unresolved,
  };
}
