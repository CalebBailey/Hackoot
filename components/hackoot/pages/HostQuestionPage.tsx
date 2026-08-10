"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuizStore } from "@/store/quizStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { Timer } from "../Timer";
import { AnswerGrid } from "../AnswerGrid";
import { navigate } from "../HackootApp";
import { Users, Eye, Zap } from "lucide-react";
import { HostPeer } from "@/transport/peer";
import { calculateKahootPoints, getResponseTime, sanitizeQuestionTimeLimit } from "@/utils/scoring";
import { getSelectableChoices, normaliseAnswer, resolveQuizType } from "@/utils/teamBuilding";

interface HostQuestionPageProps {
  quizId: string;
}

export function HostQuestionPage({ quizId }: HostQuestionPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const quiz = getQuizById(quizId);

  const session = useSessionStore((state) => state.session);
  const startQuestion = useSessionStore((state) => state.startQuestion);
  const recordAnswer = useSessionStore((state) => state.recordAnswer);
  const recordTeamChoiceAnswer = useSessionStore((state) => state.recordTeamChoiceAnswer);
  const recordTeamTextAnswers = useSessionStore((state) => state.recordTeamTextAnswers);
  const discussionIntroParticipantIds = useSessionStore((state) => state.discussionIntroParticipantIds);
  const setSessionState = useSessionStore((state) => state.setSessionState);

  const [timerRunning, setTimerRunning] = useState(false);
  const [canReveal, setCanReveal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const questionStartTimeRef = useRef<number>(0);

  const hostPeer = (window as any).__hackootHostPeer as HostPeer | undefined;

  // Get question index from session, default to 0 if not started
  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const questionDuration = sanitizeQuestionTimeLimit(currentQuestion?.timeLimit);
  const quizType = resolveQuizType(quiz?.quizType);
  const isTeamBuilding = quizType === "team-building";
  const isDiscussionVotingEnabled = quiz?.teamBuildingSettings?.enableDiscussionVoting ?? true;

  useEffect(() => {
    if (!quiz || !session || !hostPeer || initialized) {
      if (!quiz || !session || !hostPeer) {
        navigate("/");
      }
      return;
    }

    const question = quiz.questions[currentQuestionIndex];
    if (!question) {
      navigate("/");
      return;
    }

    const introParticipantIds: string[] = [];

    startQuestion(currentQuestionIndex, question, questionDuration, introParticipantIds);
    questionStartTimeRef.current = Date.now();
    setTimerRunning(true);
    setCanReveal(false);
    setInitialized(true);

    // Broadcast question to players (without correct answers)
    hostPeer.broadcastQuestion(question, currentQuestionIndex, quiz.questions.length, introParticipantIds);

    // Handle incoming answers with Kahoot scoring
    hostPeer.onAnswerReceived = (participantId, questionId, choiceId, submittedAt) => {
      if (isTeamBuilding) {
        return;
      }

      if (questionId !== question.id) return;
      if (question.type !== "mcq") return;

      const responseTime = getResponseTime(questionStartTimeRef.current, submittedAt);
      const correct = question.correctChoiceIds.includes(choiceId);
      const points = calculateKahootPoints(correct, responseTime, questionDuration, question.doublePoints ?? false);

      recordAnswer(participantId, questionId, choiceId, submittedAt, correct, points);
    };

    hostPeer.onChoiceAnswerReceived = (participantId, questionId, choiceId, submittedAt) => {
      if (!isTeamBuilding) {
        return;
      }
      if (questionId !== question.id) return;
      recordTeamChoiceAnswer(participantId, questionId, choiceId, submittedAt);
    };

    hostPeer.onTextAnswersReceived = (participantId, questionId, answers, submittedAt) => {
      if (!isTeamBuilding) {
        return;
      }
      if (questionId !== question.id) return;
      let cleanedAnswers = answers.map((answer) => answer.trim()).filter(Boolean);

      if (question.type === "select-or-text" && !(question.allowCustomAnswer ?? true)) {
        const allowedOptionKeys = new Set(
          question.options
            .map((option) => normaliseAnswer(option.text))
            .filter((key): key is string => key.length > 0)
        );
        cleanedAnswers = cleanedAnswers.filter((answer) => {
          const normalised = normaliseAnswer(answer);
          return normalised.length > 0 && allowedOptionKeys.has(normalised);
        });
      }

      recordTeamTextAnswers(participantId, questionId, cleanedAnswers, submittedAt);
    };
  }, [
    quiz,
    session,
    hostPeer,
    currentQuestionIndex,
    startQuestion,
    recordAnswer,
    recordTeamChoiceAnswer,
    recordTeamTextAnswers,
    initialized,
    questionDuration,
    isTeamBuilding,
  ]);

  // Reset initialized when navigating to a new question
  useEffect(() => {
    setInitialized(false);
    setTimerRunning(false);
    setCanReveal(false);
  }, [currentQuestionIndex]);

  // Check if all players have answered
  useEffect(() => {
    if (!session) return;
    const introParticipants =
      isTeamBuilding && currentQuestion?.type === "discussion" && discussionIntroParticipantIds.length > 0
        ? session.participants.filter((participant) => discussionIntroParticipantIds.includes(participant.participantId))
        : session.participants;
    const allAnswered = introParticipants.length > 0 && introParticipants.every((participant) => participant.answeredCurrentQuestion);
    if (allAnswered) {
      setCanReveal(true);
      setTimerRunning(false);
    }
  }, [
    currentQuestion?.type,
    discussionIntroParticipantIds,
    isTeamBuilding,
    session?.participants,
  ]);

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    setCanReveal(true);
  }, []);

  const handleReveal = () => {
    if (isTeamBuilding && session && currentQuestion) {
      const submissionCount = session.answers.filter((answer) => answer.questionId === currentQuestion.id).length;
      hostPeer?.broadcast({
        type: "teamSubmissionClosed",
        questionId: currentQuestion.id,
        submissionCount,
      });
      const shouldOpenDiscussionVoting =
        currentQuestion.type === "discussion" && isDiscussionVotingEnabled;
      setSessionState(shouldOpenDiscussionVoting ? "team-voting" : "team-results");
    }
    navigate(`/host/${quizId}/results`);
  };

  if (!quiz || !session || !currentQuestion) {
    return null;
  }

  const introParticipants =
    isTeamBuilding && currentQuestion.type === "discussion" && discussionIntroParticipantIds.length > 0
      ? session.participants.filter((participant) => discussionIntroParticipantIds.includes(participant.participantId))
      : session.participants;
  const answeredCount = introParticipants.filter((participant) => participant.answeredCurrentQuestion).length;
  const totalCount = introParticipants.length;

  const isDoublePoints = currentQuestion.type === "mcq" ? (currentQuestion.doublePoints ?? false) : false;
  const selectableChoices = getSelectableChoices(currentQuestion);

  return (
    <div
      className={`flex flex-col px-4 py-3 max-w-3xl mx-auto ${
        isTeamBuilding ? "min-h-screen overflow-y-auto" : "h-screen overflow-hidden"
      }`}
    >
      {isDoublePoints && <div className="double-points-vignette" aria-hidden="true" />}

      {/* Header - CSS grid keeps timer pixel-perfect centred */}
      <div className="grid grid-cols-3 items-center mb-2">
        <div className="text-sm text-[var(--text-secondary)]">
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </div>
        <div className="flex justify-center">
          <Timer
            totalSeconds={questionDuration}
            onExpire={handleTimerExpire}
            running={timerRunning}
          />
        </div>
        <div className="flex items-center justify-end gap-2 text-[var(--text-secondary)]">
          <Users className="w-4 h-4" />
          <span>{answeredCount}/{totalCount} answered</span>
        </div>
      </div>

      {isDoublePoints && (
        <div className="flex justify-center mb-2">
          <div className="double-points-badge flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold text-sm shadow-lg shadow-amber-500/20">
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
            Double Points
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
        </div>
      )}

      {/* Question */}
      <div className="glass-card p-4 mb-3 text-center">
        {currentQuestion.imageUrl && (
          <div className="mb-2 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Question illustration"
              className="max-h-[18vh] w-auto rounded-lg object-contain"
            />
          </div>
        )}
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)] text-balance">
          {currentQuestion.text}
        </h2>
      </div>

      {/* Answer Grid */}
      <div className="flex justify-center mb-3">
        {selectableChoices.length > 0 ? (
          <AnswerGrid choices={selectableChoices} locked={true} />
        ) : (
          <div className="w-full glass-card p-4 text-center text-[var(--text-secondary)] text-sm">
            {isTeamBuilding && currentQuestion.type === "discussion"
              ? "Awaiting discussion prompts from players"
              : "Awaiting free-text responses from players"}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-3 mb-3">
        <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-2">
          <span>Responses</span>
          <span>{answeredCount} of {totalCount}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-action)] transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Reveal Button */}
      <Button variant="primary" size="lg" fullWidth onClick={handleReveal} disabled={!canReveal}>
        <Eye className="w-5 h-5 mr-2" />
        {canReveal
          ? isTeamBuilding
            ? currentQuestion.type === "discussion" && isDiscussionVotingEnabled
              ? "Open Voting"
              : "Show Team Results"
            : "Reveal Answers"
          : "Waiting for responses..."}
      </Button>
    </div>
  );
}
