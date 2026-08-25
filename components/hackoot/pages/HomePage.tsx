"use client";

import { useRef } from "react";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "../Button";
import { QuizCard } from "../QuizCard";
import { navigate } from "../HackootApp";
import { Plus, Upload, Gamepad2 } from "lucide-react";
import { Quiz } from "@/types";

export function HomePage() {
  const quizzes = useQuizStore((state) => state.quizzes);
  const deleteQuiz = useQuizStore((state) => state.deleteQuiz);
  const importQuiz = useQuizStore((state) => state.importQuiz);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const quiz = JSON.parse(event.target?.result as string) as Quiz;
        importQuiz(quiz);
      } catch (err) {
        alert("Invalid quiz file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDelete = (quizId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteQuiz(quizId);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-6">
        <img src="/logo.png" alt="Hackoot Logo" className="mx-auto mb-3 w-auto h-28 sm:h-36 md:h-44" />
        <p className="text-[var(--text-secondary)]">
          Create and host interactive quizzes
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate("/quiz/new")}
        >
          <Plus className="w-5 h-5 mr-2" />
          New Quiz
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-5 h-5 mr-2" />
          Import Quiz
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate("/join")}
        >
          <Gamepad2 className="w-5 h-5 mr-2" />
          Join Game
        </Button>
      </div>

      {/* Quiz Grid */}
      {quizzes.length === 0 ? (
        <div className="glass-card p-6 text-center max-w-xl mx-auto">
          <div className="max-w-md mx-auto">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">
              No quizzes yet
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Create your first quiz or import an existing one to get started.
            </p>
            <Button variant="primary" onClick={() => navigate("/quiz/new")}>
              Create Your First Quiz
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz.quizId}
              quiz={quiz}
              onEdit={() => navigate(`/quiz/${quiz.quizId}/edit`)}
              onStart={() => navigate(`/host/${quiz.quizId}`)}
              onDelete={() => handleDelete(quiz.quizId, quiz.title)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
