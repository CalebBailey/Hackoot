"use client";

import { Choice } from "@/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface AnswerGridProps {
  choices: Choice[];
  onSelect?: (choiceId: string) => void;
  selectedId?: string;
  locked?: boolean;
  revealedCorrectIds?: string[];
  showChoiceText?: boolean;
}

const COLORS = [
  { bg: "bg-[#10B981]", name: "emerald" }, // A - top-left
  { bg: "bg-[#F59E0B]", name: "amber" },   // B - top-right
  { bg: "bg-[#F43F5E]", name: "rose" },    // C - bottom-left
  { bg: "bg-[#3B82F6]", name: "blue" },    // D - bottom-right
];

function getChoiceLabel(index: number): string {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }

  return `${index + 1}`;
}

export function AnswerGrid({
  choices,
  onSelect,
  selectedId,
  locked,
  revealedCorrectIds,
  showChoiceText = true,
}: AnswerGridProps) {
  const isRevealed = revealedCorrectIds && revealedCorrectIds.length > 0;

  return (
    <div 
      className="grid grid-cols-2 gap-3 w-full max-w-2xl"
      role="group"
      aria-label="Answer choices"
    >
      {choices.map((choice, index) => {
        const isSelected = selectedId === choice.id;
        const isCorrect = revealedCorrectIds?.includes(choice.id);
        const color = COLORS[index % COLORS.length];
        const choiceLabel = getChoiceLabel(index);

        return (
          <button
            key={choice.id}
            onClick={() => !locked && onSelect?.(choice.id)}
            disabled={locked && !isRevealed}
            className={cn(
              "relative p-4 sm:p-6 rounded-xl text-white font-semibold text-lg sm:text-xl transition-all duration-200",
              color.bg,
              !locked && "hover:scale-[1.02] active:scale-[0.98]",
              locked && isSelected && "scale-[0.97]",
              locked && !isSelected && !isRevealed && "opacity-40",
              isRevealed && isCorrect && "pulse-glow",
              isRevealed && !isCorrect && "opacity-60"
            )}
            aria-pressed={isSelected}
            aria-label={showChoiceText ? `Answer ${choiceLabel}: ${choice.text}` : `Answer ${choiceLabel}`}
          >
            <span className="absolute top-2 left-3 text-sm font-bold opacity-70">
              {choiceLabel}
            </span>
            {showChoiceText ? <span className="block mt-2">{choice.text}</span> : null}
            
            {/* Selected indicator */}
            {locked && isSelected && !isRevealed && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/20 rounded-xl">
                <Check className="w-12 h-12 text-white" />
              </div>
            )}

            {/* Revealed correct indicator */}
            {isRevealed && isCorrect && (
              <div className="absolute top-2 right-2">
                <Check className="w-6 h-6 text-white" />
              </div>
            )}

            {/* Revealed incorrect indicator */}
            {isRevealed && !isCorrect && isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                <X className="w-12 h-12 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
