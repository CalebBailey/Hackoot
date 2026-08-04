"use client";

import { useEffect, useState } from "react";
import { Choice, Question, QuizType } from "@/types";
import {
  GripVertical,
  Trash2,
  Check,
  Image,
  X,
  Zap,
  Plus,
  Minus,
} from "lucide-react";
import { GiphyPicker } from "./GiphyPicker";
import {
  DEFAULT_QUESTION_TIME_LIMIT,
  sanitizeQuestionTimeLimit,
} from "@/utils/scoring";
import { generateUUID } from "@/lib/utils";
import {
  TeamQuestionType,
  createEmptyTeamQuestion,
} from "@/utils/teamBuilding";

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface QuestionEditorProps {
  question: Question;
  quizType: QuizType;
  index: number;
  onChange: (question: Question) => void;
  onDelete: () => void;
}

export function QuestionEditor({
  question,
  quizType,
  index,
  onChange,
  onDelete,
}: QuestionEditorProps) {
  const timeLimit = sanitizeQuestionTimeLimit(question.timeLimit);
  const [imageInput, setImageInput] = useState(question.imageUrl ?? "");
  const [imageError, setImageError] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [timeLimitInput, setTimeLimitInput] = useState(String(timeLimit));

  useEffect(() => {
    setTimeLimitInput(String(timeLimit));
  }, [timeLimit]);

  const updateMcqChoice = (choiceIndex: number, text: string) => {
    if (question.type !== "mcq") return;
    const nextChoices = [...question.choices];
    nextChoices[choiceIndex] = { ...nextChoices[choiceIndex], text };
    onChange({ ...question, choices: nextChoices });
  };

  const updateTeamOption = (optionIndex: number, text: string) => {
    if (question.type === "this-or-that") {
      const nextOptions: [Choice, Choice] = [...question.options];
      nextOptions[optionIndex] = { ...nextOptions[optionIndex], text };
      onChange({ ...question, options: nextOptions });
      return;
    }

    if (question.type === "select-or-text") {
      const nextOptions = [...question.options];
      nextOptions[optionIndex] = { ...nextOptions[optionIndex], text };
      onChange({ ...question, options: nextOptions });
    }
  };

  const setCorrectAnswer = (choiceId: string) => {
    if (question.type !== "mcq") return;
    onChange({ ...question, correctChoiceIds: [choiceId] });
  };

  const switchTeamQuestionType = (nextType: TeamQuestionType) => {
    if (quizType !== "team-building") return;
    const nextQuestion = createEmptyTeamQuestion(nextType);
    onChange({
      ...nextQuestion,
      id: question.id,
      text: question.text,
      imageUrl: question.imageUrl,
      timeLimit: question.timeLimit,
    });
  };

  const addSelectOrTextOption = () => {
    if (question.type !== "select-or-text") return;
    onChange({
      ...question,
      options: [...question.options, { id: generateUUID(), text: "" }],
    });
  };

  const removeSelectOrTextOption = (choiceId: string) => {
    if (question.type !== "select-or-text") return;
    if (question.options.length <= 2) return;
    onChange({
      ...question,
      options: question.options.filter((choice) => choice.id !== choiceId),
    });
  };

  const updateMaxAnswers = (value: string) => {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;

    if (question.type === "free-text" || question.type === "discussion" || question.type === "select-or-text") {
      onChange({
        ...question,
        maxAnswersPerPlayer: safeValue,
      });
    }
  };

  const updateMaxVotes = (value: string) => {
    if (question.type !== "discussion") return;
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
    onChange({
      ...question,
      maxVotesPerPlayer: safeValue,
    });
  };

  const currentMaxAnswers =
    question.type === "free-text" || question.type === "discussion" || question.type === "select-or-text"
      ? Math.max(1, Math.floor(question.maxAnswersPerPlayer ?? 3))
      : 1;

  const currentMaxVotes =
    question.type === "discussion"
      ? Math.max(1, Math.floor(question.maxVotesPerPlayer ?? 3))
      : 1;

  const handleImageUrlCommit = () => {
    const trimmed = imageInput.trim();
    if (trimmed === "") {
      onChange({ ...question, imageUrl: undefined });
      setImageError(false);
    } else if (isValidImageUrl(trimmed)) {
      onChange({ ...question, imageUrl: trimmed });
      setImageError(false);
    } else {
      setImageError(true);
    }
  };

  const handleRemoveImage = () => {
    setImageInput("");
    setImageError(false);
    setShowGiphyPicker(false);
    onChange({ ...question, imageUrl: undefined });
  };

  const handleGiphySelect = (url: string) => {
    setImageInput(url);
    setImageError(false);
    setShowGiphyPicker(false);
    onChange({ ...question, imageUrl: url });
  };

  const colors = [
    { bg: "bg-emerald-500", ring: "ring-emerald-400" },
    { bg: "bg-amber-500", ring: "ring-amber-400" },
    { bg: "bg-rose-500", ring: "ring-rose-400" },
    { bg: "bg-blue-500", ring: "ring-blue-400" },
  ];
  const labels = ["A", "B", "C", "D"];
  const teamTypeLabels: Record<TeamQuestionType, string> = {
    "this-or-that": "This or that",
    "free-text": "Type in answer",
    "select-or-text": "Select and type",
    discussion: "Discussion",
  };

  const commitTimeLimitInput = () => {
    const trimmed = timeLimitInput.trim();
    if (trimmed === "") {
      setTimeLimitInput(String(timeLimit));
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setTimeLimitInput(String(timeLimit));
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setTimeLimitInput(String(timeLimit));
      return;
    }

    const sanitized = sanitizeQuestionTimeLimit(parsed);
    onChange({
      ...question,
      timeLimit: sanitized,
    });
    setTimeLimitInput(String(sanitized));
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="cursor-move text-[var(--text-secondary)] mt-2 opacity-50">
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Question {index + 1}
            </span>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-rose-500/20 transition-colors text-rose-400"
              aria-label="Delete question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {quizType === "team-building" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Question type</label>
              <select
                value={question.type === "mcq" ? "this-or-that" : question.type}
                onChange={(e) => switchTeamQuestionType(e.target.value as TeamQuestionType)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)]"
              >
                {(Object.keys(teamTypeLabels) as TeamQuestionType[]).map((type) => (
                  <option key={type} value={type} className="bg-slate-900 text-white">
                    {teamTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Question text */}
          <input
            type="text"
            value={question.text}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Enter your question..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
          />

          {/* Image */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              <input
                type="url"
                value={imageInput}
                onChange={(e) => {
                  setImageInput(e.target.value);
                  setImageError(false);
                }}
                onBlur={handleImageUrlCommit}
                placeholder="Image URL (optional)"
                className={`flex-1 bg-white/5 border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 transition-all ${
                  imageError ? "border-rose-500" : "border-white/10 focus:border-[var(--color-action)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowGiphyPicker((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                  showGiphyPicker
                    ? "bg-[var(--color-action)]/20 border-[var(--color-action)]/60 text-[var(--color-action)]"
                    : "bg-white/5 border-white/10 text-[var(--text-secondary)] hover:border-[var(--color-action)]/40 hover:text-[var(--color-action)]"
                }`}
                aria-pressed={showGiphyPicker}
                aria-label="Search Giphy for a GIF"
              >
                GIF
              </button>
              {question.imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 transition-colors text-rose-400 shrink-0"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showGiphyPicker && (
              <GiphyPicker
                onSelect={handleGiphySelect}
                onClose={() => setShowGiphyPicker(false)}
              />
            )}
            {imageError && (
              <p className="text-xs text-rose-400 pl-6">Please enter a valid http or https URL.</p>
            )}
            {question.imageUrl && !imageError && (
              <div className="pl-6">
                <img
                  src={question.imageUrl}
                  alt="Question preview"
                  className="max-h-40 rounded-lg object-contain border border-white/10"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
          </div>

          {question.type === "mcq" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {question.choices.map((choice, choiceIndex) => {
                  const isCorrect = question.correctChoiceIds.includes(choice.id);
                  const color = colors[choiceIndex] ?? colors[0];

                  return (
                    <div key={choice.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(choice.id)}
                        className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 transition-all ${color.bg} ${
                          isCorrect
                            ? `ring-2 ${color.ring} ring-offset-2 ring-offset-[#1a1025] scale-105`
                            : "opacity-50 hover:opacity-75"
                        }`}
                        aria-label={`Mark answer ${labels[choiceIndex] ?? "A"} as correct`}
                        aria-pressed={isCorrect}
                      >
                        {isCorrect ? <Check className="w-5 h-5" strokeWidth={3} /> : labels[choiceIndex] ?? "A"}
                      </button>
                      <input
                        type="text"
                        value={choice.text}
                        onChange={(e) => updateMcqChoice(choiceIndex, e.target.value)}
                        placeholder={`Answer ${labels[choiceIndex] ?? "A"}`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                <p className="text-xs text-[var(--text-secondary)]/60">
                  {timeLimit || DEFAULT_QUESTION_TIME_LIMIT} seconds - Up to {question.doublePoints ? "2000" : "1000"} points based on speed
                </p>
                <button
                  type="button"
                  onClick={() => onChange({ ...question, doublePoints: !question.doublePoints })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    question.doublePoints
                      ? "bg-amber-500/20 border-amber-400/60 text-amber-300 ring-1 ring-amber-400/40"
                      : "bg-white/5 border-white/10 text-[var(--text-secondary)] hover:border-amber-400/40 hover:text-amber-300"
                  }`}
                  aria-pressed={question.doublePoints ?? false}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Double Points
                </button>
              </div>
            </>
          )}

          {question.type === "this-or-that" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="space-y-1">
                  <label className="text-xs text-[var(--text-secondary)]">
                    {optionIndex === 0 ? "This" : "That"}
                  </label>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateTeamOption(optionIndex, e.target.value)}
                    placeholder={optionIndex === 0 ? "Option A" : "Option B"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
                  />
                </div>
              ))}
            </div>
          )}

          {question.type === "select-or-text" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <span className="w-8 text-xs text-[var(--text-secondary)]">{labels[optionIndex] ?? `O${optionIndex + 1}`}</span>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateTeamOption(optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => removeSelectOrTextOption(option.id)}
                      disabled={question.options.length <= 2}
                      className="p-2 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:text-rose-300 hover:border-rose-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Remove option"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={addSelectOrTextOption}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-[var(--text-secondary)] hover:border-[var(--color-action)]/40 hover:text-[var(--color-action)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
                <label className="text-xs text-[var(--text-secondary)] flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  Allow custom answer
                  <span className="relative inline-flex h-5 w-9 shrink-0">
                    <input
                      type="checkbox"
                      checked={question.allowCustomAnswer ?? true}
                      onChange={(e) => onChange({ ...question, allowCustomAnswer: e.target.checked })}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full border border-white/15 bg-white/10 transition-colors peer-checked:bg-[var(--color-action)]/30 peer-checked:border-[var(--color-action)]/50 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-action)]/50" aria-hidden="true" />
                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" aria-hidden="true" />
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Max answers per player</label>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => updateMaxAnswers(String(Math.max(1, currentMaxAnswers - 1)))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Decrease max answers"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={currentMaxAnswers}
                    onChange={(e) => updateMaxAnswers(e.target.value)}
                    className="w-14 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateMaxAnswers(String(currentMaxAnswers + 1))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Increase max answers"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {question.type === "free-text" && (
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Max answers per player</label>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={() => updateMaxAnswers(String(Math.max(1, currentMaxAnswers - 1)))}
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Decrease max answers"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={currentMaxAnswers}
                  onChange={(e) => updateMaxAnswers(e.target.value)}
                  className="w-14 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => updateMaxAnswers(String(currentMaxAnswers + 1))}
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                  aria-label="Increase max answers"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {question.type === "discussion" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Max answers per player</label>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => updateMaxAnswers(String(Math.max(1, currentMaxAnswers - 1)))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Decrease max answers"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={currentMaxAnswers}
                    onChange={(e) => updateMaxAnswers(e.target.value)}
                    className="w-14 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateMaxAnswers(String(currentMaxAnswers + 1))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Increase max answers"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Max votes per player</label>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => updateMaxVotes(String(Math.max(1, currentMaxVotes - 1)))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Decrease max votes"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={currentMaxVotes}
                    onChange={(e) => updateMaxVotes(e.target.value)}
                    className="w-14 bg-transparent border-0 text-center text-sm text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateMaxVotes(String(currentMaxVotes + 1))}
                    className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:bg-white/5"
                    aria-label="Increase max votes"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <label htmlFor={`time-limit-${question.id}`} className="text-xs text-[var(--text-secondary)]/80">
              Time
            </label>
            <input
              id={`time-limit-${question.id}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={timeLimitInput}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "");
                setTimeLimitInput(digitsOnly);
              }}
              onBlur={commitTimeLimitInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTimeLimitInput();
                }
              }}
              className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)]"
            />
            <span className="text-xs text-[var(--text-secondary)]/80">sec</span>
          </div>
        </div>
      </div>
    </div>
  );
}
