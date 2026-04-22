"use client";

import { useState } from "react";
import { Question } from "@/types";
import { GripVertical, Trash2, Check, Image, X } from "lucide-react";

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
  index: number;
  onChange: (question: Question) => void;
  onDelete: () => void;
}

export function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: QuestionEditorProps) {
  const [imageInput, setImageInput] = useState(question.imageUrl ?? "");
  const [imageError, setImageError] = useState(false);

  const updateChoice = (choiceIndex: number, text: string) => {
    const newChoices = [...question.choices];
    newChoices[choiceIndex] = { ...newChoices[choiceIndex], text };
    onChange({ ...question, choices: newChoices });
  };

  const setCorrectAnswer = (choiceId: string) => {
    onChange({ ...question, correctChoiceIds: [choiceId] });
  };

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
    onChange({ ...question, imageUrl: undefined });
  };

  const colors = [
    { bg: "bg-emerald-500", ring: "ring-emerald-400" },
    { bg: "bg-amber-500", ring: "ring-amber-400" },
    { bg: "bg-rose-500", ring: "ring-rose-400" },
    { bg: "bg-blue-500", ring: "ring-blue-400" },
  ];
  const labels = ["A", "B", "C", "D"];

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

          {/* Question text */}
          <input
            type="text"
            value={question.text}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Enter your question..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
          />

          {/* Image URL */}
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

          {/* Choices - click the button to mark as correct */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.choices.map((choice, choiceIndex) => {
              const isCorrect = question.correctChoiceIds.includes(choice.id);
              const color = colors[choiceIndex];

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
                    aria-label={`Mark answer ${labels[choiceIndex]} as correct`}
                    aria-pressed={isCorrect}
                  >
                    {isCorrect ? (
                      <Check className="w-5 h-5" strokeWidth={3} />
                    ) : (
                      labels[choiceIndex]
                    )}
                  </button>
                  <input
                    type="text"
                    value={choice.text}
                    onChange={(e) => updateChoice(choiceIndex, e.target.value)}
                    placeholder={`Answer ${labels[choiceIndex]}`}
                    className={`flex-1 bg-white/5 border rounded-lg px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 transition-all ${
                      isCorrect 
                        ? `border-${color.bg.replace('bg-', '')}/50` 
                        : "border-white/10 focus:border-[var(--color-action)]"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Info about scoring */}
          <p className="text-xs text-[var(--text-secondary)]/60 pt-1">
            20 seconds per question - Up to 1000 points based on speed
          </p>
        </div>
      </div>
    </div>
  );
}
