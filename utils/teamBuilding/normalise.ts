const DEFAULT_SYNONYMS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  ai: "artificial intelligence",
  ux: "user experience",
  ui: "user interface",
  pm: "product management",
};

const TECHNICAL_NAME_ALIASES: Record<string, string> = {
  "c sharp": "c#",
  "c-sharp": "c#",
  csharp: "c#",
  "f sharp": "f#",
  "f-sharp": "f#",
  fsharp: "f#",
  "c plus plus": "c++",
  "c-plus-plus": "c++",
  cplusplus: "c++",
  cpp: "c++",
  "dot net": ".net",
  dotnet: ".net",
  "asp net": "asp.net",
  aspnet: "asp.net",
  "node js": "node.js",
  nodejs: "node.js",
};

function stripBoundaryNoise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[`'"([{<*_]+/, "")
    .replace(/[`'"\])}>*_]+$/, "")
    .replace(/^[,!?;:]+/, "")
    .replace(/[,!?;:]+$/, "")
    .replace(/^[_/\\]+|[_/\\]+$/g, "")
    .replace(/\.+$/, "")
    .trim();
}

function normaliseTechnicalAliases(value: string): string {
  const directAlias = TECHNICAL_NAME_ALIASES[value];
  if (directAlias) {
    return directAlias;
  }

  return value
    .replace(/\bc\s*\+\s*\+\b/g, "c++")
    .replace(/\bc\s*#\b/g, "c#")
    .replace(/\bf\s*#\b/g, "f#");
}

export interface NormaliseOptions {
  synonyms?: Record<string, string>;
}

export function normaliseAnswer(raw: string, options: NormaliseOptions = {}): string {
  const synonyms = {
    ...DEFAULT_SYNONYMS,
    ...(options.synonyms ?? {}),
  };

  const stripped = stripBoundaryNoise(raw);

  if (!stripped) {
    return "";
  }

  const technicalNormalised = normaliseTechnicalAliases(stripped);

  return synonyms[technicalNormalised] ?? technicalNormalised;
}
