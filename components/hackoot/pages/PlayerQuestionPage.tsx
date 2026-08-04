"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Timer } from "../Timer";
import { AnswerGrid } from "../AnswerGrid";
import { navigate } from "../HackootApp";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { DEFAULT_QUESTION_TIME_LIMIT } from "@/utils/scoring";
import { Plus, Send, Zap } from "lucide-react";
import { getSelectableChoices, resolveQuizType } from "@/utils/teamBuilding";

export function PlayerQuestionPage() {
  const session = useSessionStore((state) => state.session);
  const currentQuestion = useSessionStore((state) => state.currentQuestion);
  const participantId = useSessionStore((state) => state.participantId);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);
  const hasAnsweredCurrentQuestion = useSessionStore((state) => state.hasAnsweredCurrentQuestion);
  const setHasAnsweredCurrentQuestion = useSessionStore((state) => state.setHasAnsweredCurrentQuestion);
  const currentQuestionDuration = useSessionStore((state) => state.currentQuestionDuration);
  const setTeamVoteContext = useSessionStore((state) => state.setTeamVoteContext);
  const setTeamResultsSnapshot = useSessionStore((state) => state.setTeamResultsSnapshot);
  const setSessionState = useSessionStore((state) => state.setSessionState);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textAnswers, setTextAnswers] = useState<string[]>([]);
  const [locked, setLocked] = useState(hasAnsweredCurrentQuestion);
  const [timerRunning, setTimerRunning] = useState(!hasAnsweredCurrentQuestion);

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;
  const isTeamBuilding =
    resolveQuizType(session?.quizType) === "team-building" ||
    (currentQuestion !== null && currentQuestion.type !== "mcq");

  useEffect(() => {
    if (!playerPeer || !currentQuestion) {
      navigate("/join");
      return;
    }

    // If this is a normal new question (not a rejoin), reset the answered state
    if (!hasAnsweredCurrentQuestion) {
      setSelectedId(null);
      setSelectedOptionIds([]);
      setTextInput("");
      setTextAnswers([]);
      setLocked(false);
      setTimerRunning(true);
    }

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "answerRevealed") {
        const pointsAwarded = participantId ? (message.playerPoints[participantId] ?? 0) : 0;
        updateLeaderboard(message.leaderboard, pointsAwarded);
        navigate("/play/result");
      } else if (message.type === "teamVotingOpened") {
        setTeamVoteContext({
          questionId: message.questionId,
          candidates: message.candidates,
          maxVotesPerPlayer: message.maxVotesPerPlayer,
          allowOwnAnswerVoting: message.allowOwnAnswerVoting,
        });
        setSessionState("team-voting");
        navigate("/play/voting");
      } else if (message.type === "teamResultsPublished") {
        setTeamResultsSnapshot({
          questionId: message.questionId,
          groupedAnswers: message.groupedAnswers ?? [],
          wordCloud: message.wordCloud ?? [],
          discussionQueue: message.discussionQueue ?? [],
        }, message.sessionState ?? "team-results");
        setSessionState(message.sessionState ?? "team-results");
        navigate("/play/result");
      } else if (message.type === "teamSubmissionClosed") {
        setSessionState("team-results");
      } else if (message.type === "sessionEnded") {
        updateLeaderboard(message.finalLeaderboard, 0);
        navigate("/play/final");
      }
    };
  }, [
    playerPeer,
    currentQuestion,
    participantId,
    updateLeaderboard,
    hasAnsweredCurrentQuestion,
    setSessionState,
    setTeamResultsSnapshot,
    setTeamVoteContext,
  ]);

  const addTextAnswer = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;

    const maxAnswers =
      currentQuestion?.type === "free-text" ||
      currentQuestion?.type === "discussion" ||
      currentQuestion?.type === "select-or-text"
        ? currentQuestion.maxAnswersPerPlayer ?? 3
        : 1;

    if (textAnswers.length >= maxAnswers) {
      return;
    }

    setTextAnswers((current) => [...current, trimmed]);
    setTextInput("");
  };

  const removeTextAnswer = (index: number) => {
    setTextAnswers((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const toggleSelectOrTextOption = (choiceId: string) => {
    if (locked) return;
    if (!currentQuestion || currentQuestion.type !== "select-or-text") return;

    const optionIsSelected = selectedOptionIds.includes(choiceId);
    const maxAnswers = currentQuestion.maxAnswersPerPlayer ?? 3;

    if (optionIsSelected) {
      setSelectedOptionIds((current) => current.filter((id) => id !== choiceId));
      return;
    }

    const totalCurrentAnswers = selectedOptionIds.length + textAnswers.length;
    if (totalCurrentAnswers >= maxAnswers) {
      return;
    }

    setSelectedOptionIds((current) => [...current, choiceId]);
  };

  const handleSelect = (choiceId: string) => {
    if (locked || !playerPeer || !currentQuestion) return;

    setSelectedId(choiceId);
    setLocked(true);
    setTimerRunning(false);
    setHasAnsweredCurrentQuestion(true);

    if (currentQuestion.type === "mcq") {
      playerPeer.send({
        type: "submitAnswer",
        participantId: participantId!,
        questionId: currentQuestion.id,
        choiceId,
        submittedAt: Date.now(),
      });
      return;
    }

    playerPeer.send({
      type: "submitChoiceAnswer",
      participantId: participantId!,
      questionId: currentQuestion.id,
      choiceId,
      submittedAt: Date.now(),
    });
  };

  const handleSubmitTextAnswers = () => {
    if (locked || !playerPeer || !currentQuestion || !participantId) return;

    const selectableChoices = getSelectableChoices(currentQuestion);
    const selectedOptionTexts = selectableChoices
      .filter((choice) => selectedOptionIds.includes(choice.id))
      .map((choice) => choice.text.trim())
      .filter(Boolean);

    const allAnswers = Array.from(new Set([...selectedOptionTexts, ...textAnswers.map((answer) => answer.trim())]))
      .filter(Boolean);

    if (allAnswers.length === 0) return;

    setLocked(true);
    setTimerRunning(false);
    setHasAnsweredCurrentQuestion(true);

    playerPeer.send({
      type: "submitTextAnswers",
      participantId,
      questionId: currentQuestion.id,
      answers: allAnswers,
      submittedAt: Date.now(),
    });
  };

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    setLocked(true);
  }, []);

  if (!currentQuestion) {
    return null;
  }

  const isDoublePoints = currentQuestion.type === "mcq" ? (currentQuestion.doublePoints ?? false) : false;
  const selectableChoices = getSelectableChoices(currentQuestion);
  const isTextSubmissionQuestion =
    currentQuestion.type === "free-text" ||
    currentQuestion.type === "discussion" ||
    currentQuestion.type === "select-or-text";
  const maxAnswers =
    currentQuestion.type === "free-text" ||
    currentQuestion.type === "discussion" ||
    currentQuestion.type === "select-or-text"
      ? currentQuestion.maxAnswersPerPlayer ?? 3
      : 1;

  return (
    <div className="h-screen overflow-hidden flex flex-col px-4 py-4 max-w-2xl mx-auto">
      {isDoublePoints && <div className="double-points-vignette" aria-hidden="true" />}

      {/* Points info / double points badge */}
      <div className="flex justify-center mb-3">
        {!isTeamBuilding && isDoublePoints ? (
          <div className="double-points-badge flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold text-sm shadow-lg shadow-amber-500/20">
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
            Double Points - Up to 2000
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
        ) : !isTeamBuilding ? (
          <p className="text-sm text-[var(--text-secondary)]">Up to 1000 points</p>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Team Building mode - no points</p>
        )}
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-4">
        <Timer
          totalSeconds={currentQuestionDuration || DEFAULT_QUESTION_TIME_LIMIT}
          onExpire={handleTimerExpire}
          running={timerRunning}
        />
      </div>

      {/* Question */}
      <div
        className="glass-card p-5 mb-4 text-center"
        role="region"
        aria-live="assertive"
        aria-label="Current question"
      >
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)] text-balance">
          {currentQuestion.text}
        </h2>
        {currentQuestion.imageUrl && (
          <div className="mt-3 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Question illustration"
              className="max-h-36 rounded-lg object-contain"
            />
          </div>
        )}
      </div>

      {/* Answer Grid */}
      <div className="flex-1 flex items-center justify-center">
        {!isTextSubmissionQuestion ? (
          <AnswerGrid
            choices={selectableChoices}
            onSelect={handleSelect}
            selectedId={selectedId || undefined}
            locked={locked}
          />
        ) : (
          <div className="w-full max-w-xl space-y-4">
            {currentQuestion.type === "select-or-text" && selectableChoices.length > 0 && (
              <div className="glass-card p-4 space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">Select one or more options</p>
                <div className="space-y-2">
                  {selectableChoices.map((choice) => {
                    const checked = selectedOptionIds.includes(choice.id);
                    return (
                      <label
                        key={choice.id}
                        className="flex items-center gap-2 text-[var(--text-primary)] bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectOrTextOption(choice.id)}
                          disabled={locked}
                        />
                        {choice.text}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="glass-card p-4">
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Add up to {maxAnswers} answer{maxAnswers !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTextAnswer();
                    }
                  }}
                  placeholder="Type your answer"
                  disabled={locked || textAnswers.length >= maxAnswers}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)]"
                />
                <button
                  type="button"
                  onClick={addTextAnswer}
                  disabled={locked || textAnswers.length >= maxAnswers}
                  className="p-2 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:text-[var(--color-action)] hover:border-[var(--color-action)]/50 disabled:opacity-40"
                  aria-label="Add answer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {textAnswers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {textAnswers.map((answer, index) => (
                    <button
                      key={`${answer}-${index}`}
                      type="button"
                      onClick={() => removeTextAnswer(index)}
                      disabled={locked}
                      className="px-2.5 py-1 rounded-full text-sm bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/25"
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitTextAnswers}
                disabled={locked || selectedOptionIds.length + textAnswers.length === 0}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-action)] text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Submit response
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {locked && (
        <div className="text-center py-3">
          <p className="text-[var(--text-secondary)]">
            {hasAnsweredCurrentQuestion ? "Answer submitted! Waiting for results..." : "Time's up!"}
          </p>
        </div>
      )}
    </div>
  );
}
