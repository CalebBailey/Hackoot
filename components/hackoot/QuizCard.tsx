"use client";

import { Quiz } from "@/types";
import { Button } from "./Button";
import { Pencil, Play, Trash2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { exportQuiz } from "@/utils/quizStorage";

interface QuizCardProps {
  quiz: Quiz;
  onEdit: () => void;
  onStart: () => void;
  onDelete: () => void;
}

export function QuizCard({ quiz, onEdit, onStart, onDelete }: QuizCardProps) {
  const handleExport = () => {
    exportQuiz(quiz);
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4 fade-in">
      <div className="flex-1">
        <h3 className="text-lg font-heading font-bold text-[var(--text-primary)] line-clamp-2">
          {quiz.title}
        </h3>
        {quiz.description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
            {quiz.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-[var(--text-secondary)]">
          <span>{quiz.questions.length} questions</span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(quiz.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          className="flex-1"
          aria-label={`Edit ${quiz.title}`}
        >
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onStart}
          className="flex-1"
          aria-label={`Start ${quiz.title}`}
        >
          <Play className="w-4 h-4 mr-1" />
          Start
        </Button>
        <button
          onClick={handleExport}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
          aria-label={`Export ${quiz.title} as JSON`}
          title="Export as JSON"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-[#F43F5E]/20 transition-colors text-[#F43F5E]"
          aria-label={`Delete ${quiz.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
