"use client";

import { useState, useEffect } from "react";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "../Button";
import { QuestionEditor } from "../QuestionEditor";
import { navigate } from "../HackootApp";
import { ArrowLeft, Plus, Save, Download, AlertCircle } from "lucide-react";
import { Quiz, Question } from "@/types";
import { exportQuiz } from "@/utils/quizStorage";
import { generateUUID } from "@/lib/utils";
import { DEFAULT_QUESTION_TIME_LIMIT, sanitizeQuestionTimeLimit } from "@/utils/scoring";

interface EditQuizPageProps {
  quizId: string;
}

function createEmptyQuestion(): Question {
  return {
    id: generateUUID(),
    type: "mcq",
    text: "",
    choices: [
      { id: generateUUID(), text: "" },
      { id: generateUUID(), text: "" },
      { id: generateUUID(), text: "" },
      { id: generateUUID(), text: "" },
    ],
    correctChoiceIds: [],
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
  };
}

function validateQuestion(q: Question, index: number): string | null {
  if (!q.text.trim()) {
    return `Question ${index + 1}: Please enter a question`;
  }
  
  const filledChoices = q.choices.filter(c => c.text.trim());
  if (filledChoices.length < 2) {
    return `Question ${index + 1}: Please provide at least 2 answer options`;
  }
  
  if (q.correctChoiceIds.length === 0) {
    return `Question ${index + 1}: Please select the correct answer`;
  }
  
  const correctChoice = q.choices.find(c => q.correctChoiceIds.includes(c.id));
  if (!correctChoice || !correctChoice.text.trim()) {
    return `Question ${index + 1}: The correct answer must have text`;
  }
  
  return null;
}

export function EditQuizPage({ quizId }: EditQuizPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const updateQuiz = useQuizStore((state) => state.updateQuiz);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuiz, setOriginalQuiz] = useState<Quiz | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const quiz = getQuizById(quizId);
    if (quiz) {
      setOriginalQuiz(quiz);
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setQuestions(quiz.questions.map((question) => ({
        ...question,
        timeLimit: sanitizeQuestionTimeLimit(question.timeLimit),
      })));
    } else {
      navigate("/");
    }
  }, [quizId, getQuizById]);

  const handleAddQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()]);
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

  const handleSave = () => {
    setError(null);
    
    if (!title.trim()) {
      setError("Please enter a quiz title");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const validationError = validateQuestion(questions[i], i);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!originalQuiz) return;

    setSaving(true);

    const cleanedQuestions = questions.map(q => ({
      ...q,
      choices: q.choices.filter(c => c.text.trim()),
      timeLimit: sanitizeQuestionTimeLimit(q.timeLimit),
    }));

    const updatedQuiz: Quiz = {
      ...originalQuiz,
      title: title.trim(),
      description: description.trim() || undefined,
      version: originalQuiz.version + 1,
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
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {questions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={index}
            onChange={(q) => handleUpdateQuestion(index, q)}
            onDelete={() => handleDeleteQuestion(index)}
          />
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
  );
}
