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

export interface BuildWordCloudOptions extends NormaliseOptions {
  topN?: number;
  stopWords?: string[];
}

export function buildWordCloud(answers: string[], options: BuildWordCloudOptions = {}): WordCloudTerm[] {
  const topN = Math.max(1, options.topN ?? 40);
  const stopWords = new Set([...DEFAULT_STOP_WORDS, ...(options.stopWords ?? []).map((w) => w.toLowerCase())]);

  const counts = new Map<string, number>();

  for (const answer of answers) {
    const normalised = normaliseAnswer(answer, options);
    if (!normalised) {
      continue;
    }

    const tokens = normalised.split(" ");
    for (const token of tokens) {
      const cleaned = token.trim();
      if (!cleaned || stopWords.has(cleaned)) {
        continue;
      }
      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([text, weight]) => ({ text, weight }))
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
    .slice(0, topN);
}
