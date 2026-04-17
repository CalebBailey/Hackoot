import { Quiz } from "../types";

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
    return raw ? (JSON.parse(raw) as Quiz[]) : [];
  } catch {
    return [];
  }
}

export function deleteQuiz(quizId: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadAllQuizzes().filter(q => q.quizId !== quizId)));
}

export function exportQuiz(quiz: Quiz): void {
  const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: "application/json" });
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
