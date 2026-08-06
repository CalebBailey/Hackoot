import { TeamAnswerCluster } from "@/types";
import { normaliseAnswer, NormaliseOptions } from "./normalise";

const PHRASE_MATCH_THRESHOLD = 0.65;
const MIN_SHARED_TOKENS = 2;
const SINGLE_SHARED_TOKEN_THRESHOLD = 0.78;
const HIGH_CONFIDENCE_STRING_MATCH_THRESHOLD = 0.9;
const SINGLE_TOKEN_STRING_MATCH_THRESHOLD = 0.94;
const MIN_COMPACT_KEY_LENGTH_FOR_FUZZY = 4;
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
  "so",
  "that",
  "the",
  "their",
  "this",
  "to",
  "too",
  "up",
  "us",
  "we",
  "with",
  "you",
]);
const DOUBLED_CONSONANT_ENDING = /(bb|dd|ff|gg|ll|mm|nn|pp|rr|tt)$/;

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
  aliasKeys: Set<string>;
  tokenSet: Set<string>;
  tokenFrequency: Map<string, number>;
}

function stemToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }

  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.length > 5 && token.endsWith("ing")) {
    let stem = token.slice(0, -3);
    if (DOUBLED_CONSONANT_ENDING.test(stem)) {
      stem = stem.slice(0, -1);
    }

    if (!stem.endsWith("e") && /[bcdfghjklmnpqrstvwxyz]$/.test(stem) && stem.length > 3) {
      return `${stem}e`;
    }

    return stem;
  }

  if (token.length > 4 && token.endsWith("ed")) {
    let stem = token.slice(0, -2);
    if (DOUBLED_CONSONANT_ENDING.test(stem)) {
      stem = stem.slice(0, -1);
    }
    return stem;
  }

  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (
    token.length > 3 &&
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("us") &&
    !token.endsWith("is")
  ) {
    return token.slice(0, -1);
  }

  return token;
}

function removeDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "");
}

function sanitiseText(value: string): string {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[_/\\-]+/g, " ");
}

function expandNormalisedToken(token: string, options: NormaliseOptions): string[] {
  const canonical = normaliseAnswer(token, options);
  if (!canonical) {
    return [];
  }

  return canonical.split(/\s+/).filter(Boolean);
}

function buildTokenSet(text: string, options: NormaliseOptions): Set<string> {
  const tokens = sanitiseText(text)
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .split(/\s+/)
    .flatMap((token) => expandNormalisedToken(token, options))
    .map((token) => stemToken(token))
    .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token));

  return new Set(tokens);
}

function buildCompactKey(text: string): string {
  return sanitiseText(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

function scoreStringSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftBigrams = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    leftBigrams.set(pair, (leftBigrams.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = leftBigrams.get(pair) ?? 0;
    if (count <= 0) {
      continue;
    }
    overlap += 1;
    leftBigrams.set(pair, count - 1);
  }

  const leftCount = left.length - 1;
  const rightCount = right.length - 1;
  return (2 * overlap) / (leftCount + rightCount);
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

function getComparisonTokenSet(bucket: ClusterBucket): Set<string> {
  const minimumFrequency = Math.max(1, Math.ceil(bucket.groupedAnswers.length * 0.4));
  const stableTokens = new Set<string>();

  for (const [token, frequency] of bucket.tokenFrequency) {
    if (frequency >= minimumFrequency) {
      stableTokens.add(token);
    }
  }

  return stableTokens.size > 0 ? stableTokens : bucket.tokenSet;
}

function findSimilarBucket(
  canonicalKey: string,
  tokens: Set<string>,
  buckets: ClusterBucket[]
): ClusterBucket | null {
  const compactKey = buildCompactKey(canonicalKey);
  if (!compactKey) {
    return null;
  }

  let bestMatch: { bucket: ClusterBucket; score: number } | null = null;
  const allowStringFuzzy = compactKey.length >= MIN_COMPACT_KEY_LENGTH_FOR_FUZZY;

  for (const bucket of buckets) {
    if (bucket.aliasKeys.has(canonicalKey)) {
      return bucket;
    }

    const comparisonTokens = getComparisonTokenSet(bucket);
    const { score: tokenScore, sharedTokenCount } = scoreTokenSimilarity(tokens, comparisonTokens);
    let stringScore = 0;
    for (const aliasKey of bucket.aliasKeys) {
      const compactBucketKey = buildCompactKey(aliasKey);
      stringScore = Math.max(stringScore, scoreStringSimilarity(compactKey, compactBucketKey));
      if (stringScore === 1) {
        break;
      }
    }

    const phraseMatch =
      sharedTokenCount >= MIN_SHARED_TOKENS &&
      tokenScore >= PHRASE_MATCH_THRESHOLD;
    const singleSharedTokenMatch =
      allowStringFuzzy &&
      sharedTokenCount === 1 &&
      tokenScore >= SINGLE_SHARED_TOKEN_THRESHOLD &&
      stringScore >= HIGH_CONFIDENCE_STRING_MATCH_THRESHOLD;
    const singleTokenMatch =
      allowStringFuzzy &&
      (tokens.size <= 1 || comparisonTokens.size <= 1) &&
      stringScore >= SINGLE_TOKEN_STRING_MATCH_THRESHOLD;

    if (!phraseMatch && !singleSharedTokenMatch && !singleTokenMatch) {
      continue;
    }

    const compositeScore = phraseMatch
      ? tokenScore * 0.8 + stringScore * 0.2
      : tokenScore * 0.5 + stringScore * 0.5;

    if (!bestMatch || compositeScore > bestMatch.score) {
      bestMatch = { bucket, score: compositeScore };
    }
  }

  return bestMatch?.bucket ?? null;
}

function addAnswerToBucket(
  bucket: ClusterBucket,
  answer: RawTeamAnswer,
  canonicalKey: string,
  tokens: Set<string>
): void {
  bucket.groupedAnswers.push(answer);
  bucket.participantIds.add(answer.participantId);
  bucket.aliasKeys.add(canonicalKey);

  for (const token of tokens) {
    bucket.tokenSet.add(token);
    bucket.tokenFrequency.set(token, (bucket.tokenFrequency.get(token) ?? 0) + 1);
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
      addAnswerToBucket(existingBucket, answer, key, answerTokens);
      continue;
    }

    const similarBucket = findSimilarBucket(key, answerTokens, buckets);
    if (similarBucket) {
      addAnswerToBucket(similarBucket, answer, key, answerTokens);
      bucketsByCanonicalText.set(key, similarBucket);
      continue;
    }

    const tokenFrequency = new Map<string, number>();
    for (const token of answerTokens) {
      tokenFrequency.set(token, 1);
    }

    const newBucket: ClusterBucket = {
      canonicalText: key,
      groupedAnswers: [answer],
      participantIds: new Set([answer.participantId]),
      aliasKeys: new Set([key]),
      tokenSet: answerTokens,
      tokenFrequency,
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
