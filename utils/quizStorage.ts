import {
  Choice,
  Question,
  Quiz,
  QuizType,
  TeamBuildingQuizSettings,
} from "../types";
import {
  DEFAULT_TEAM_BUILDING_SETTINGS,
  resolveQuizType,
} from "./teamBuilding/defaults";

function toChoice(raw: unknown, fallbackIndex: number): Choice {
  const value = raw as Partial<Choice> | undefined;
  return {
    id: value?.id && typeof value.id === "string" ? value.id : `choice-${fallbackIndex + 1}`,
    text: value?.text && typeof value.text === "string" ? value.text : "",
  };
}

function normaliseQuestion(raw: unknown, index: number): Question {
  const value = (raw as Record<string, unknown>) ?? {};
  const type = value.type;
  const base = {
    id: typeof value.id === "string" ? value.id : `question-${index + 1}`,
    text: typeof value.text === "string" ? value.text : "",
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    timeLimit: typeof value.timeLimit === "number" ? value.timeLimit : undefined,
  };

  if (type === "this-or-that") {
    const options = Array.isArray(value.options) ? value.options : [];
    return {
      ...base,
      type,
      options: [toChoice(options[0], 0), toChoice(options[1], 1)],
    };
  }

  if (type === "free-text") {
    return {
      ...base,
      type,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
    };
  }

  if (type === "select-or-text") {
    return {
      ...base,
      type,
      options: Array.isArray(value.options)
        ? value.options.map((choice, choiceIndex) => toChoice(choice, choiceIndex))
        : [],
      allowCustomAnswer:
        typeof value.allowCustomAnswer === "boolean" ? value.allowCustomAnswer : true,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
    };
  }

  if (type === "discussion") {
    return {
      ...base,
      type,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
      maxVotesPerPlayer:
        typeof value.maxVotesPerPlayer === "number" ? value.maxVotesPerPlayer : undefined,
    };
  }

  const choices = Array.isArray(value.choices) ? value.choices : [];
  const correctChoiceIds = Array.isArray(value.correctChoiceIds)
    ? value.correctChoiceIds.filter((choiceId): choiceId is string => typeof choiceId === "string")
    : [];

  return {
    ...base,
    type: "mcq",
    choices: choices.map((choice, choiceIndex) => toChoice(choice, choiceIndex)),
    correctChoiceIds,
    doublePoints: typeof value.doublePoints === "boolean" ? value.doublePoints : undefined,
  };
}

function normaliseTeamSettings(
  raw: unknown,
  quizType: QuizType
): TeamBuildingQuizSettings | undefined {
  if (quizType !== "team-building") {
    return undefined;
  }

  const value = (raw as Partial<TeamBuildingQuizSettings>) ?? {};

  return {
    ...DEFAULT_TEAM_BUILDING_SETTINGS,
    ...value,
  };
}

function normaliseQuiz(raw: unknown): Quiz {
  const value = (raw as Record<string, unknown>) ?? {};
  const quizType = resolveQuizType(value.quizType as QuizType | undefined);

  return {
    quizId: typeof value.quizId === "string" ? value.quizId : "",
    title: typeof value.title === "string" ? value.title : "Untitled Quiz",
    description: typeof value.description === "string" ? value.description : undefined,
    createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
    version: typeof value.version === "number" ? value.version : 1,
    quizType,
    teamBuildingSettings: normaliseTeamSettings(value.teamBuildingSettings, quizType),
    questions: Array.isArray(value.questions)
      ? value.questions.map((question, index) => normaliseQuestion(question, index))
      : [],
  };
}

const KEY = "hackoot:quizzes";

export function saveQuiz(quiz: Quiz): void {
  const all = loadAllQuizzes();
  const i = all.findIndex(q => q.quizId === quiz.quizId);
  if (i >= 0) all[i] = quiz; else all.push(quiz);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function loadAllQuizzes(): Quiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((quiz) => normaliseQuiz(quiz));
  } catch {
    return [];
  }
}

export function deleteQuiz(quizId: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadAllQuizzes().filter(q => q.quizId !== quizId)));
}

export function exportQuiz(quiz: Quiz): void {
  const normalisedQuiz = normaliseQuiz(quiz);
  const blob = new Blob([JSON.stringify(normalisedQuiz, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${quiz.title.replace(/\s+/g, "-").toLowerCase()}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSessionResults(sessionData: object, quizTitle: string): void {
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${quizTitle.replace(/\s+/g, "-").toLowerCase()}-results.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
