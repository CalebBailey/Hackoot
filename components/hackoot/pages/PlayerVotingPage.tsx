"use client";

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { navigate } from "../HackootApp";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { Send, Vote } from "lucide-react";
import { Button } from "../Button";
import { Checkbox } from "@/components/ui/checkbox";

export function PlayerVotingPage() {
  const participantId = useSessionStore((state) => state.participantId);
  const teamVoteContext = useSessionStore((state) => state.teamVoteContext);
  const setHasAnsweredCurrentQuestion = useSessionStore((state) => state.setHasAnsweredCurrentQuestion);
  const setSessionState = useSessionStore((state) => state.setSessionState);
  const setTeamResultsSnapshot = useSessionStore((state) => state.setTeamResultsSnapshot);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);

  const [selectedAnswerIds, setSelectedAnswerIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;

  const visibleCandidates = useMemo(() => {
    if (!teamVoteContext) return [];
    return teamVoteContext.candidates.filter((candidate) => {
      if (teamVoteContext.allowOwnAnswerVoting) return true;
      const contributorIds = candidate.participantIds?.length
        ? candidate.participantIds
        : [candidate.participantId];
      return participantId ? !contributorIds.includes(participantId) : true;
    });
  }, [teamVoteContext, participantId]);

  useEffect(() => {
    if (!playerPeer || !teamVoteContext) {
      navigate("/play/question");
      return;
    }

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "teamVotingClosed") {
        setSessionState("team-results");
      } else if (message.type === "teamResultsPublished") {
        setTeamResultsSnapshot({
          questionId: message.questionId,
          groupedAnswers: message.groupedAnswers ?? [],
          wordCloud: message.wordCloud ?? [],
          discussionQueue: message.discussionQueue ?? [],
        }, message.sessionState ?? "team-results");
        setSessionState(message.sessionState ?? "team-results");
        navigate("/play/result");
      } else if (message.type === "sessionEnded") {
        updateLeaderboard(message.finalLeaderboard, 0);
        navigate("/play/final");
      }
    };
  }, [playerPeer, teamVoteContext, setSessionState, setTeamResultsSnapshot, updateLeaderboard]);

  const toggleVote = (answerId: string) => {
    if (submitted || !teamVoteContext) return;

    if (selectedAnswerIds.includes(answerId)) {
      setSelectedAnswerIds((current) => current.filter((id) => id !== answerId));
      return;
    }

    if (selectedAnswerIds.length >= teamVoteContext.maxVotesPerPlayer) {
      return;
    }

    setSelectedAnswerIds((current) => [...current, answerId]);
  };

  const submitVotes = () => {
    if (!playerPeer || !teamVoteContext || !participantId || selectedAnswerIds.length === 0 || submitted) {
      return;
    }

    setSubmitted(true);
    setHasAnsweredCurrentQuestion(true);

    playerPeer.send({
      type: "submitDiscussionVotes",
      participantId,
      questionId: teamVoteContext.questionId,
      answerIds: selectedAnswerIds,
      submittedAt: Date.now(),
    });
  };

  if (!teamVoteContext) {
    return null;
  }

  const reachedVoteLimit = selectedAnswerIds.length >= teamVoteContext.maxVotesPerPlayer;

  return (
    <div className="min-h-screen overflow-y-auto flex flex-col px-4 py-4 max-w-2xl mx-auto">
      <div className="glass-card p-6 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-[var(--color-action)]" />
            <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Vote for discussion prompts</h1>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-action)]/15 border border-[var(--color-action)]/30 text-[var(--text-primary)]">
            {selectedAnswerIds.length}/{teamVoteContext.maxVotesPerPlayer}
          </span>
        </div>
        <p className="text-[var(--text-secondary)]">
          Choose up to {teamVoteContext.maxVotesPerPlayer} responses.
        </p>
      </div>

      <div className="glass-card p-4 flex-1 overflow-hidden flex flex-col">
        {visibleCandidates.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No eligible answers to vote on.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1">
            {visibleCandidates.map((candidate) => {
              const isSelected = selectedAnswerIds.includes(candidate.id);
              const disableUnchecked = !isSelected && reachedVoteLimit;
              const disabled = submitted || disableUnchecked;

              return (
                <label
                  key={candidate.id}
                  htmlFor={`vote-${candidate.id}`}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-center gap-3 ${
                    isSelected
                      ? "bg-[var(--color-action)]/15 border-[var(--color-action)]/40 text-[var(--text-primary)]"
                      : "bg-white/[0.03] border-white/10 text-[var(--text-primary)] hover:border-[var(--color-action)]/40"
                  } ${disabled ? "opacity-70" : "cursor-pointer"}`}
                >
                  <Checkbox
                    id={`vote-${candidate.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleVote(candidate.id)}
                    disabled={disabled}
                    aria-label={`Vote for response ${candidate.text}`}
                    className="size-5 border-white/30 data-[state=checked]:bg-[var(--color-action)] data-[state=checked]:border-[var(--color-action)] data-[state=checked]:text-white"
                  />
                  <span className="flex-1">{candidate.text}</span>
                  {isSelected && (
                    <span className="text-xs font-medium text-[var(--color-action)]">Selected</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        {!submitted && reachedVoteLimit && visibleCandidates.length > 0 && (
          <p className="mt-3 text-xs text-amber-300/90">
            Maximum votes reached. Remove one selection to pick another.
          </p>
        )}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={submitVotes}
          disabled={submitted || selectedAnswerIds.length === 0}
        >
          <Send className="w-4 h-4 mr-2" />
          {submitted ? "Votes submitted" : "Submit votes"}
        </Button>
        {submitted && (
          <p className="text-center text-sm text-[var(--text-secondary)] mt-2">
            Votes received. Waiting for host.
          </p>
        )}
      </div>
    </div>
  );
}
