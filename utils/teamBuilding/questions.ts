import { generateUUID } from "@/lib/utils";
import {
  Choice,
  Question,
  QuizType,
  TeamDiscussionQuestion,
  TeamFreeTextQuestion,
  TeamSelectOrTextQuestion,
  TeamThisOrThatQuestion,
} from "@/types";
import { DEFAULT_QUESTION_TIME_LIMIT } from "@/utils/scoring";

export type TeamQuestionType =
  | TeamThisOrThatQuestion["type"]
  | TeamFreeTextQuestion["type"]
  | TeamSelectOrTextQuestion["type"]
  | TeamDiscussionQuestion["type"];

function createChoice(text = ""): Choice {
  return {
    id: generateUUID(),
    text,
  };
}

export function createEmptyMcqQuestion(): Question {
  return {
    id: generateUUID(),
    type: "mcq",
    text: "",
    choices: [createChoice(), createChoice(), createChoice(), createChoice()],
    correctChoiceIds: [],
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
  };
}

export function createEmptyTeamQuestion(type: TeamQuestionType = "this-or-that"): Question {
  const base = {
    id: generateUUID(),
    text: "",
    imageUrl: undefined,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
  };

  if (type === "this-or-that") {
    return {
      ...base,
      type,
      options: [createChoice(), createChoice()],
    };
  }

  if (type === "free-text") {
    return {
      ...base,
      type,
      maxAnswersPerPlayer: 3,
    };
  }

  if (type === "select-or-text") {
    return {
      ...base,
      type,
      options: [createChoice(), createChoice(), createChoice()],
      allowCustomAnswer: true,
      maxAnswersPerPlayer: 3,
    };
  }

  return {
    ...base,
    type: "discussion",
    maxAnswersPerPlayer: 3,
    maxVotesPerPlayer: 3,
  };
}

export function createEmptyQuestionForQuizType(
  quizType: QuizType,
  requestedType?: TeamQuestionType
): Question {
  if (quizType === "team-building") {
    return createEmptyTeamQuestion(requestedType);
  }
  return createEmptyMcqQuestion();
}

export function validateQuestionForQuizType(
  question: Question,
  index: number,
  quizType: QuizType
): string | null {
  if (!question.text.trim()) {
    return `Question ${index + 1}: Please enter a question`;
  }

  if (quizType === "standard") {
    if (question.type !== "mcq") {
      return `Question ${index + 1}: Standard quizzes only support MCQ questions`;
    }

    const filledChoices = question.choices.filter((choice) => choice.text.trim());
    if (filledChoices.length < 2) {
      return `Question ${index + 1}: Please provide at least 2 answer options`;
    }

    if (question.correctChoiceIds.length === 0) {
      return `Question ${index + 1}: Please select the correct answer`;
    }

    const hasValidCorrectChoice = question.choices.some(
      (choice) => question.correctChoiceIds.includes(choice.id) && choice.text.trim()
    );

    if (!hasValidCorrectChoice) {
      return `Question ${index + 1}: The correct answer must have text`;
    }

    return null;
  }

  if (question.type === "this-or-that") {
    const filledOptions = question.options.filter((option) => option.text.trim());
    if (filledOptions.length !== 2) {
      return `Question ${index + 1}: This or that requires exactly 2 options`;
    }
    return null;
  }

  if (question.type === "select-or-text") {
    const filledOptions = question.options.filter((option) => option.text.trim());
    if (filledOptions.length < 2) {
      return `Question ${index + 1}: Select and type requires at least 2 options`;
    }
    return null;
  }

  if (question.type === "free-text" || question.type === "discussion") {
    if ((question.maxAnswersPerPlayer ?? 0) < 1) {
      return `Question ${index + 1}: Max answers must be at least 1`;
    }
  }

  if (question.type === "discussion") {
    if ((question.maxVotesPerPlayer ?? 0) < 1) {
      return `Question ${index + 1}: Max votes must be at least 1`;
    }
  }

  return null;
}

export function getSelectableChoices(question: Question): Choice[] {
  if (question.type === "mcq") {
    return question.choices;
  }
  if (question.type === "this-or-that") {
    return question.options;
  }
  if (question.type === "select-or-text") {
    return question.options;
  }
  return [];
}
