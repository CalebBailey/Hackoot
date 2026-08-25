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
  compact?: boolean;
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
  compact = false,
}: AnswerGridProps) {
  const isRevealed = revealedCorrectIds && revealedCorrectIds.length > 0;
  const isLetterOnly = !showChoiceText;

  return (
    <div 
      className={cn(
        "grid grid-cols-2 w-full max-w-2xl",
        compact ? "gap-2.5" : "gap-3"
      )}
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
              "relative rounded-xl text-white font-semibold transition-all duration-200",
              showChoiceText
                ? compact
                  ? "p-3 sm:p-4 text-base sm:text-lg text-left"
                  : "p-4 sm:p-6 text-lg sm:text-xl text-left"
                : compact
                  ? "p-4 sm:p-5 min-h-[102px] sm:min-h-[116px] flex items-center justify-center"
                  : "p-6 sm:p-8 min-h-[124px] sm:min-h-[140px] flex items-center justify-center",
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
            {showChoiceText ? (
              <>
                <span className="absolute top-3 left-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/35 bg-black/30 text-base font-black leading-none shadow-sm">
                  {choiceLabel}
                </span>
                <span className={cn("block", compact ? "mt-7" : "mt-8")}>{choice.text}</span>
              </>
            ) : (
              <span
                className={cn(
                  "font-black leading-none tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
                  compact
                    ? isLetterOnly ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
                    : isLetterOnly ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl"
                )}
              >
                {choiceLabel}
              </span>
            )}
            
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
