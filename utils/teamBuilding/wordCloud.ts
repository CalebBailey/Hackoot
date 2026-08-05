import { WordCloudTerm } from "@/types";
import { normaliseAnswer, NormaliseOptions } from "./normalise";

const DEFAULT_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "in",
  "of",
  "for",
  "on",
  "is",
  "it",
  "with",
  "that",
  "this",
  "be",
  "as",
  "at",
  "by",
  "from",
]);

const TOKEN_MATCH_REGEX = /[\p{L}\p{N}][\p{L}\p{N}'+#-]*/gu;

export interface BuildWordCloudOptions extends NormaliseOptions {
  topN?: number;
  stopWords?: string[];
}

function getCustomSynonyms(options: BuildWordCloudOptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(options.synonyms ?? {}).map(([key, value]) => [
      key.toLowerCase().trim(),
      value.toLowerCase().trim(),
    ])
  );
}

function extractTokens(answer: string, options: BuildWordCloudOptions): string[] {
  const compact = answer.trim().toLowerCase().replace(/\s+/g, " ");
  if (!compact) {
    return [];
  }

  const rawTokens = compact.match(TOKEN_MATCH_REGEX) ?? compact.split(" ");
  const customSynonyms = getCustomSynonyms(options);
  const tokens: string[] = [];

  for (const rawToken of rawTokens) {
    const cleaned = rawToken.trim();
    if (!cleaned) {
      continue;
    }

    const mappedByCustomSynonym = customSynonyms[cleaned];
    const canonicalToken = mappedByCustomSynonym
      ? mappedByCustomSynonym
      : /^[\p{L}\p{N}]+$/u.test(cleaned)
        ? normaliseAnswer(cleaned, options)
        : cleaned;

    const expandedTokens = canonicalToken
      .split(" ")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    tokens.push(...expandedTokens);
  }

  return tokens;
}

export function buildWordCloud(answers: string[], options: BuildWordCloudOptions = {}): WordCloudTerm[] {
  const topN = Math.max(1, options.topN ?? 40);
  const stopWords = new Set([...DEFAULT_STOP_WORDS, ...(options.stopWords ?? []).map((w) => w.toLowerCase())]);

  const counts = new Map<string, number>();

  for (const answer of answers) {
    const tokens = extractTokens(answer, options);
    if (tokens.length === 0) {
      continue;
    }

    const nonStopTokens = tokens.filter((token) => !stopWords.has(token));
    const tokensToCount = nonStopTokens.length > 0 ? nonStopTokens : tokens;

    for (const token of tokensToCount) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([text, weight]) => ({ text, weight }))
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
    .slice(0, topN);
}
