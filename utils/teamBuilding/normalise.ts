const DEFAULT_SYNONYMS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  ai: "artificial intelligence",
  ux: "user experience",
  ui: "user interface",
  pm: "product management",
};

export interface NormaliseOptions {
  synonyms?: Record<string, string>;
}

export function normaliseAnswer(raw: string, options: NormaliseOptions = {}): string {
  const synonyms = {
    ...DEFAULT_SYNONYMS,
    ...(options.synonyms ?? {}),
  };

  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}#+]+|[^\p{L}\p{N}#+]+$/gu, "")
    .replace(/\s+/g, " ");

  if (!stripped) {
    return "";
  }

  return synonyms[stripped] ?? stripped;
}
