"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Timer } from "../Timer";
import { AnswerGrid } from "../AnswerGrid";
import { Button } from "../Button";
import { navigate } from "../HackootApp";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { DEFAULT_QUESTION_TIME_LIMIT } from "@/utils/scoring";
import { Plus, Send, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getSelectableChoices, normaliseAnswer, resolveQuizType } from "@/utils/teamBuilding";

const STANDARD_OPTION_BASE_COLOURS = [
  { rgb: "16, 185, 129", badge: "#10B981" },
  { rgb: "245, 158, 11", badge: "#F59E0B" },
  { rgb: "244, 63, 94", badge: "#F43F5E" },
  { rgb: "59, 130, 246", badge: "#3B82F6" },
];

function getOptionLabel(index: number): string {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }

  return `${index + 1}`;
}

function getOptionPalette(index: number) {
  const colour = STANDARD_OPTION_BASE_COLOURS[index % STANDARD_OPTION_BASE_COLOURS.length];
  const cycleIndex = Math.floor(index / STANDARD_OPTION_BASE_COLOURS.length);
  const baseAlphaBoost = Math.min(cycleIndex * 0.03, 0.12);
  const activeAlphaBoost = Math.min(cycleIndex * 0.05, 0.16);

  return {
    baseRowStyle: {
      backgroundColor: `rgba(${colour.rgb}, ${0.10 + baseAlphaBoost})`,
      borderColor: `rgba(${colour.rgb}, ${0.36 + baseAlphaBoost})`,
    },
    activeRowStyle: {
      backgroundColor: `rgba(${colour.rgb}, ${0.22 + activeAlphaBoost})`,
      borderColor: `rgba(${colour.rgb}, ${0.70 + activeAlphaBoost * 0.5})`,
    },
    badgeStyle: {
      backgroundColor: colour.badge,
    },
  };
}

function getOptionColumnCount(optionCount: number): number {
  if (optionCount <= 4) {
    return 1;
  }

  return Math.floor((optionCount - 5) / 6) + 2;
}

function deduplicateAnswers(values: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = normaliseAnswer(trimmed) || trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

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

    const totalCurrentAnswers =
      currentQuestion?.type === "select-or-text"
        ? selectedOptionIds.length + textAnswers.length
        : textAnswers.length;

    if (totalCurrentAnswers >= maxAnswers) {
      return;
    }

    const nextAnswers = deduplicateAnswers([...textAnswers, trimmed]);
    if (nextAnswers.length === textAnswers.length) {
      setTextInput("");
      return;
    }

    setTextAnswers(nextAnswers);
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

    const allAnswers = deduplicateAnswers([...selectedOptionTexts, ...textAnswers]);

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
  const totalDraftAnswers = selectedOptionIds.length + textAnswers.length;
  const remainingAnswers = Math.max(0, maxAnswers - totalDraftAnswers);
  const reachedMaxAnswers = totalDraftAnswers >= maxAnswers;
  const hasUnstagedDraft = textInput.trim().length > 0;
  const stagedSelectOrTextOptions =
    currentQuestion.type === "select-or-text"
      ? selectableChoices
          .map((choice, index) => ({ id: choice.id, label: getOptionLabel(index) }))
          .filter((choice) => selectedOptionIds.includes(choice.id))
      : [];

  return (
    <div className="h-screen overflow-y-auto flex flex-col px-4 py-4 max-w-2xl mx-auto">
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
      <div className={`flex-1 flex ${isTextSubmissionQuestion ? "items-start" : "items-center"} justify-center`}>
        {!isTextSubmissionQuestion ? (
          <AnswerGrid
            choices={selectableChoices}
            onSelect={handleSelect}
            selectedId={selectedId || undefined}
            locked={locked}
            showChoiceText={!isTeamBuilding}
          />
        ) : (
          <div className="w-full max-w-xl space-y-4">
            {currentQuestion.type === "select-or-text" && selectableChoices.length > 0 && (
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--text-secondary)]">Select options and/or add your own answer</p>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full border border-white/20 text-[var(--text-secondary)]">
                    {totalDraftAnswers}/{maxAnswers}
                  </span>
                </div>
                <div
                  className="grid gap-2 max-h-[42vh] overflow-y-auto pr-1"
                  style={{
                    gridTemplateColumns: `repeat(${getOptionColumnCount(selectableChoices.length)}, minmax(0, 1fr))`,
                  }}
                >
                  {selectableChoices.map((choice, index) => {
                    const checked = selectedOptionIds.includes(choice.id);
                    const disableUnchecked = !checked && reachedMaxAnswers;
                    const disabled = locked || disableUnchecked;
                    const optionLabel = getOptionLabel(index);
                    const optionPalette = getOptionPalette(index);

                    return (
                      <label
                        key={choice.id}
                        htmlFor={`choice-${choice.id}`}
                        className={`flex items-center gap-3 text-[var(--text-primary)] rounded-lg px-3 py-2.5 border transition-colors ${
                          checked ? "shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]" : ""
                        } ${disabled ? "opacity-60" : "hover:opacity-95 cursor-pointer"}`}
                        style={checked ? optionPalette.activeRowStyle : optionPalette.baseRowStyle}
                      >
                        <Checkbox
                          id={`choice-${choice.id}`}
                          checked={checked}
                          onCheckedChange={() => toggleSelectOrTextOption(choice.id)}
                          disabled={disabled}
                          aria-label={isTeamBuilding ? `Select option ${optionLabel}` : `Select option ${choice.text}`}
                          className="size-5 border-white/30 data-[state=checked]:bg-[var(--color-action)] data-[state=checked]:border-[var(--color-action)] data-[state=checked]:text-white"
                        />
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                          style={optionPalette.badgeStyle}
                          aria-hidden="true"
                        >
                          {optionLabel}
                        </span>
                        {checked && (
                          <span className="text-xs font-medium text-[var(--text-primary)]/85">Selected</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {!locked && reachedMaxAnswers && (
                  <p className="text-xs text-amber-300/90">
                    Maximum of {maxAnswers} combined answers reached. Remove one to add another.
                  </p>
                )}
              </div>
            )}

            <div className="glass-card p-4">
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Add up to {maxAnswers} answer{maxAnswers !== 1 ? "s" : ""}
                {!locked ? ` - ${remainingAnswers} remaining` : ""}
              </p>
              <div className="space-y-2">
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
                  disabled={locked || remainingAnswers === 0}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)]"
                />
                {!locked && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {hasUnstagedDraft
                      ? "Draft not staged yet. Tap Add response to include it in your submission."
                      : "Type a response and tap Add response to stage it before submitting."}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={addTextAnswer}
                disabled={locked || remainingAnswers === 0 || !textInput.trim()}
                className="mt-3 bg-[#6D8CF7] hover:bg-[#5C7DEB]"
                aria-label="Add response to staging"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add response
              </Button>

              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Staged responses (not sent yet)</p>
                  <span className="text-xs px-2 py-1 rounded-full border border-white/20 text-[var(--text-secondary)]">
                    {totalDraftAnswers}/{maxAnswers}
                  </span>
                </div>

                {totalDraftAnswers === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    No staged responses yet. Add responses above, then tap Submit response to send them.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stagedSelectOrTextOptions.map((option) => (
                      <button
                        key={`staged-option-${option.id}`}
                        type="button"
                        onClick={() => toggleSelectOrTextOption(option.id)}
                        disabled={locked}
                        className="px-2.5 py-1 rounded-full text-sm bg-white/10 border border-white/20 text-[var(--text-primary)] hover:bg-white/15"
                      >
                        Option {option.label}
                      </button>
                    ))}

                    {textAnswers.map((answer, index) => (
                      <button
                        key={`${answer}-${index}`}
                        type="button"
                        onClick={() => removeTextAnswer(index)}
                        disabled={locked}
                        className="px-2.5 py-1 rounded-full text-sm bg-[var(--color-action)]/15 border border-[var(--color-action)]/30 text-[var(--text-primary)] hover:bg-[var(--color-action)]/25"
                      >
                        {answer}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSubmitTextAnswers}
                disabled={locked || totalDraftAnswers === 0}
                className="mt-4"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit response
              </Button>
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
