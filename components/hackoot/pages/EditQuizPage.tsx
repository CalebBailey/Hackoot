"use client";

import { DragEvent, useState, useEffect } from "react";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "../Button";
import { Checkbox } from "@/components/ui/checkbox";
import { QuestionEditor } from "../QuestionEditor";
import { navigate } from "../HackootApp";
import { ArrowLeft, Plus, Minus, Save, Download, AlertCircle } from "lucide-react";
import { Choice, Quiz, Question, QuizType, TeamBuildingQuizSettings } from "@/types";
import { generateUUID } from "@/lib/utils";
import { exportQuiz } from "@/utils/quizStorage";
import { sanitizeQuestionTimeLimit } from "@/utils/scoring";
import {
  DEFAULT_TEAM_BUILDING_SETTINGS,
  createEmptyQuestionForQuizType,
  createEmptyMcqQuestion,
  createEmptyTeamQuestion,
  resolveQuizType,
  validateQuestionForQuizType,
} from "@/utils/teamBuilding";

interface EditQuizPageProps {
  quizId: string;
}

function migrateQuestionToQuizType(question: Question, quizType: QuizType): Question {
  if (quizType === "standard") {
    if (question.type === "mcq") return question;
    const replacement = createEmptyMcqQuestion();
    return {
      ...replacement,
      id: question.id,
      text: question.text,
      imageUrl: question.imageUrl,
      timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
    };
  }

  if (question.type !== "mcq") return question;
  const replacement = createEmptyTeamQuestion("this-or-that");
  return {
    ...replacement,
    id: question.id,
    text: question.text,
    imageUrl: question.imageUrl,
    timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
  };
}

export function EditQuizPage({ quizId }: EditQuizPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const updateQuiz = useQuizStore((state) => state.updateQuiz);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quizType, setQuizType] = useState<QuizType>("standard");
  const [teamBuildingSettings, setTeamBuildingSettings] =
    useState<TeamBuildingQuizSettings>(DEFAULT_TEAM_BUILDING_SETTINGS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [originalQuiz, setOriginalQuiz] = useState<Quiz | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const quiz = getQuizById(quizId);
    if (quiz) {
      const resolvedQuizType = resolveQuizType(quiz.quizType);
      setOriginalQuiz(quiz);
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setQuizType(resolvedQuizType);
      setTeamBuildingSettings({
        ...DEFAULT_TEAM_BUILDING_SETTINGS,
        ...(quiz.teamBuildingSettings ?? {}),
      });
      setQuestions(quiz.questions.map((question) => ({
        ...question,
        timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
      })));
    } else {
      navigate("/");
    }
  }, [quizId, getQuizById]);

  const handleAddQuestion = () => {
    setQuestions([...questions, createEmptyQuestionForQuizType(quizType)]);
    setError(null);
  };

  const handleQuizTypeChange = (nextQuizType: QuizType) => {
    setQuizType(nextQuizType);
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) => migrateQuestionToQuizType(question, nextQuizType))
    );
    setError(null);
  };

  const handleUpdateQuestion = (index: number, question: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = question;
    setQuestions(newQuestions);
    setError(null);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length === 1) {
      setError("You need at least one question");
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
    setError(null);
  };

  const reorderQuestions = (sourceQuestionId: string, targetQuestionId: string) => {
    setQuestions((currentQuestions) => {
      const sourceIndex = currentQuestions.findIndex((question) => question.id === sourceQuestionId);
      const targetIndex = currentQuestions.findIndex((question) => question.id === targetQuestionId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return currentQuestions;
      }

      const reorderedQuestions = [...currentQuestions];
      const [movedQuestion] = reorderedQuestions.splice(sourceIndex, 1);
      reorderedQuestions.splice(targetIndex, 0, movedQuestion);
      return reorderedQuestions;
    });
    setError(null);
  };

  const handleQuestionDragStart = (
    event: DragEvent<HTMLDivElement>,
    questionId: string
  ) => {
    event.dataTransfer.setData("text/plain", questionId);
    event.dataTransfer.effectAllowed = "move";
    setDraggedQuestionId(questionId);
    setDragOverQuestionId(questionId);
  };

  const resetDragState = () => {
    setDraggedQuestionId(null);
    setDragOverQuestionId(null);
  };

  const resolveDropTargetQuestionId = (clientY: number): string | null => {
    const dropTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-question-drop-id]")
    );

    if (dropTargets.length === 0) {
      return questions.length > 0 ? questions[questions.length - 1].id : null;
    }

    for (const target of dropTargets) {
      const rect = target.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY <= midpoint) {
        return target.dataset.questionDropId ?? null;
      }
    }

    return dropTargets[dropTargets.length - 1].dataset.questionDropId ?? null;
  };

  const handleQuestionDragOver = (
    event: DragEvent<HTMLDivElement>,
    questionId: string
  ) => {
    if (!draggedQuestionId || draggedQuestionId === questionId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverQuestionId !== questionId) {
      setDragOverQuestionId(questionId);
    }
  };

  const handleScreenDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!draggedQuestionId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const targetQuestionId = resolveDropTargetQuestionId(event.clientY);
    if (!targetQuestionId || targetQuestionId === draggedQuestionId) {
      return;
    }

    if (dragOverQuestionId !== targetQuestionId) {
      setDragOverQuestionId(targetQuestionId);
    }
  };

  const handleQuestionDrop = (
    event: DragEvent<HTMLDivElement>,
    targetQuestionId: string
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const sourceQuestionId = event.dataTransfer.getData("text/plain") || draggedQuestionId;
    if (!sourceQuestionId || sourceQuestionId === targetQuestionId) {
      resetDragState();
      return;
    }

    reorderQuestions(sourceQuestionId, targetQuestionId);
    resetDragState();
  };

  const handleScreenDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!draggedQuestionId) {
      return;
    }

    event.preventDefault();
    const sourceQuestionId = event.dataTransfer.getData("text/plain") || draggedQuestionId;
    if (!sourceQuestionId) {
      resetDragState();
      return;
    }

    const targetQuestionId = resolveDropTargetQuestionId(event.clientY);
    if (!targetQuestionId || sourceQuestionId === targetQuestionId) {
      resetDragState();
      return;
    }

    reorderQuestions(sourceQuestionId, targetQuestionId);
    resetDragState();
  };

  const handleQuestionDragEnd = () => {
    resetDragState();
  };

  const handleSave = () => {
    setError(null);
    
    if (!title.trim()) {
      setError("Please enter a quiz title");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const validationError = validateQuestionForQuizType(questions[i], i, quizType);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!originalQuiz) return;

    setSaving(true);

    const cleanedQuestions = questions.map((question) => {
      if (question.type === "mcq") {
        return {
          ...question,
          choices: question.choices.filter((choice) => choice.text.trim()),
          timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
        };
      }

      if (question.type === "this-or-that") {
        const optionA: Choice = question.options[0] ?? { id: generateUUID(), text: "" };
        const optionB: Choice = question.options[1] ?? { id: generateUUID(), text: "" };
        return {
          ...question,
          options: [optionA, optionB] as [Choice, Choice],
          timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
        };
      }

      if (question.type === "select-or-text") {
        return {
          ...question,
          options: question.options.filter((choice) => choice.text.trim()),
          maxAnswersPerPlayer: Math.max(1, Math.floor(question.maxAnswersPerPlayer ?? 3)),
          timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
        };
      }

      if (question.type === "free-text") {
        return {
          ...question,
          maxAnswersPerPlayer: Math.max(1, Math.floor(question.maxAnswersPerPlayer ?? 3)),
          timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
        };
      }

      return {
        ...question,
        maxAnswersPerPlayer: Math.max(1, Math.floor(question.maxAnswersPerPlayer ?? 3)),
        maxVotesPerPlayer: Math.max(1, Math.floor(question.maxVotesPerPlayer ?? 3)),
        timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
      };
    });

    const updatedQuiz: Quiz = {
      ...originalQuiz,
      title: title.trim(),
      description: description.trim() || undefined,
      version: originalQuiz.version + 1,
      quizType,
      teamBuildingSettings:
        quizType === "team-building"
          ? {
              ...DEFAULT_TEAM_BUILDING_SETTINGS,
              ...teamBuildingSettings,
            }
          : undefined,
      questions: cleanedQuestions,
    };

    updateQuiz(updatedQuiz);
    navigate("/");
  };

  const handleExport = () => {
    if (!originalQuiz) return;
    const quizToExport: Quiz = {
      ...originalQuiz,
      title: title.trim(),
      description: description.trim() || undefined,
      quizType,
      teamBuildingSettings:
        quizType === "team-building"
          ? {
              ...DEFAULT_TEAM_BUILDING_SETTINGS,
              ...teamBuildingSettings,
            }
          : undefined,
      questions,
    };
    exportQuiz(quizToExport);
  };

  if (!originalQuiz) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh"
      onDragOver={handleScreenDragOver}
      onDrop={handleScreenDrop}
    >
      <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg glass-card hover:bg-white/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text-primary)] flex-1">
          Edit Quiz
        </h1>
        <Button variant="ghost" onClick={handleExport}>
          <Download className="w-5 h-5 mr-2" />
          Export
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-rose-200 text-sm">{error}</p>
        </div>
      )}

      {/* Quiz Details */}
      <div className="glass-card p-5 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Quiz Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(null); }}
            placeholder="Enter quiz title..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Quiz Type
          </label>
          <select
            value={quizType}
            onChange={(e) => handleQuizTypeChange(e.target.value as QuizType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)]"
          >
            <option value="standard" className="bg-slate-900 text-white">Standard</option>
            <option value="team-building" className="bg-slate-900 text-white">Team Building</option>
          </select>
        </div>

        {quizType === "team-building" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]/80 sm:col-span-2">
              Team Building settings
            </p>

            <label
              htmlFor="team-setting-discussion-voting"
              className="text-sm text-[var(--text-secondary)] flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 cursor-pointer"
            >
              Enable discussion voting
              <Checkbox
                id="team-setting-discussion-voting"
                checked={teamBuildingSettings.enableDiscussionVoting}
                onCheckedChange={(checked) =>
                  setTeamBuildingSettings((current) => ({
                    ...current,
                    enableDiscussionVoting: checked === true,
                  }))
                }
                className="size-5 border-white/30 data-[state=checked]:bg-[var(--color-action)] data-[state=checked]:border-[var(--color-action)] data-[state=checked]:text-white"
              />
            </label>

            <label className="text-sm text-[var(--text-secondary)] flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
              Max answers per player
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxAnswersPerPlayer: Math.max(1, current.maxAnswersPerPlayer - 1),
                    }))
                  }
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Decrease max answers per player"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={teamBuildingSettings.maxAnswersPerPlayer}
                  onChange={(e) =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxAnswersPerPlayer: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-12 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxAnswersPerPlayer: current.maxAnswersPerPlayer + 1,
                    }))
                  }
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Increase max answers per player"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            </label>

            <label className="text-sm text-[var(--text-secondary)] flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
              Max votes per player
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxVotesPerPlayer: Math.max(1, current.maxVotesPerPlayer - 1),
                    }))
                  }
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Decrease max votes per player"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={teamBuildingSettings.maxVotesPerPlayer}
                  onChange={(e) =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxVotesPerPlayer: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-12 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTeamBuildingSettings((current) => ({
                      ...current,
                      maxVotesPerPlayer: current.maxVotesPerPlayer + 1,
                    }))
                  }
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Increase max votes per player"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            </label>

            <label
              htmlFor="team-setting-own-vote"
              className="text-sm text-[var(--text-secondary)] flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 cursor-pointer"
            >
              Allow own-answer voting
              <Checkbox
                id="team-setting-own-vote"
                checked={teamBuildingSettings.allowOwnAnswerVoting}
                onCheckedChange={(checked) =>
                  setTeamBuildingSettings((current) => ({
                    ...current,
                    allowOwnAnswerVoting: checked === true,
                  }))
                }
                className="size-5 border-white/30 data-[state=checked]:bg-[var(--color-action)] data-[state=checked]:border-[var(--color-action)] data-[state=checked]:text-white"
              />
            </label>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {questions.map((question, index) => (
          <div
            key={question.id}
            data-question-drop-id={question.id}
            onDragOver={(event) => handleQuestionDragOver(event, question.id)}
            onDrop={(event) => handleQuestionDrop(event, question.id)}
            className={`rounded-xl transition-all ${
              dragOverQuestionId === question.id && draggedQuestionId !== question.id
                ? "ring-2 ring-[var(--color-action)]/45"
                : ""
            }`}
          >
            <QuestionEditor
              question={question}
              quizType={quizType}
              index={index}
              onChange={(q) => handleUpdateQuestion(index, q)}
              onDelete={() => handleDeleteQuestion(index)}
              onDragStart={(event) => handleQuestionDragStart(event, question.id)}
              onDragEnd={handleQuestionDragEnd}
            />
          </div>
        ))}
      </div>

      {/* Add Question */}
      <Button
        variant="secondary"
        fullWidth
        onClick={handleAddQuestion}
        className="mb-8"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Question
      </Button>

      {/* Save */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSave}
        loading={saving}
      >
        <Save className="w-5 h-5 mr-2" />
        Save Changes
      </Button>
      </div>
    </div>
  );
}
