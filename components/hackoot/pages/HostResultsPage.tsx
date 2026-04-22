"use client";

import { useEffect, useState } from "react";
import { useQuizStore } from "@/store/quizStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { AnswerGrid } from "../AnswerGrid";
import { Leaderboard } from "../Leaderboard";
import { navigate } from "../HackootApp";
import { ArrowRight, Trophy } from "lucide-react";
import { HostPeer } from "@/transport/peer";

interface HostResultsPageProps {
  quizId: string;
}

export function HostResultsPage({ quizId }: HostResultsPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const quiz = getQuizById(quizId);

  const session = useSessionStore((state) => state.session);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const startQuestion = useSessionStore((state) => state.startQuestion);

  const [revealed, setRevealed] = useState(false);

  const hostPeer = (window as any).__hackootHostPeer as HostPeer | undefined;

  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const isLastQuestion = quiz ? currentQuestionIndex >= quiz.questions.length - 1 : true;

  useEffect(() => {
    if (!quiz || !session || !hostPeer || !currentQuestion || revealed) {
      return;
    }

    // Broadcast answer reveal to players with each player's individual points
    const leaderboard = getLeaderboard();
    const playerPoints: Record<string, number> = {};
    session.answers
      .filter((a) => a.questionId === currentQuestion.id)
      .forEach((a) => {
        playerPoints[a.participantId] = a.pointsAwarded;
      });

    hostPeer.broadcast({
      type: "answerRevealed",
      correctChoiceIds: currentQuestion.correctChoiceIds,
      leaderboard,
      playerPoints,
    });

    setRevealed(true);
  }, [quiz, session, currentQuestion, hostPeer, getLeaderboard, revealed]);

  const handleNext = () => {
    if (!quiz || !session || !hostPeer) return;

    if (isLastQuestion) {
      // End session - broadcast to players then navigate host to final leaderboard
      const finalLeaderboard = getLeaderboard();
      hostPeer.broadcast({
        type: "sessionEnded",
        finalLeaderboard,
      });
      // Host also goes to the final leaderboard view
      navigate("/play/final");
    } else {
      // Update question index in session first, then navigate
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = quiz.questions[nextIndex];
      startQuestion(nextIndex, nextQuestion);
      navigate(`/host/${quizId}/question`);
    }
  };

  if (!quiz || !session || !currentQuestion) {
    return null;
  }

  const leaderboard = getLeaderboard();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-sm text-[var(--text-secondary)] mb-1">
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </p>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)]">
          {currentQuestion.text}
        </h2>
        {currentQuestion.imageUrl && (
          <div className="mt-4 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Question illustration"
              className="max-h-48 rounded-lg object-contain"
            />
          </div>
        )}
      </div>

      {/* Answer Grid with reveal */}
      <div className="flex justify-center mb-8">
        <AnswerGrid
          choices={currentQuestion.choices}
          locked={true}
          revealedCorrectIds={revealed ? currentQuestion.correctChoiceIds : undefined}
        />
      </div>

      {/* Leaderboard */}
      <div className="flex justify-center mb-8">
        <Leaderboard entries={leaderboard} maxEntries={5} />
      </div>

      {/* Next Button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleNext}
      >
        {isLastQuestion ? (
          <>
            <Trophy className="w-5 h-5 mr-2" />
            End Session
          </>
        ) : (
          <>
            <ArrowRight className="w-5 h-5 mr-2" />
            Next Question
          </>
        )}
      </Button>
    </div>
  );
}
