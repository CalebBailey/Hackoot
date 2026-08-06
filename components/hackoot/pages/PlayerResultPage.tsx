"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { navigate } from "../HackootApp";
import { CheckCircle, XCircle, Trophy } from "lucide-react";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage, Question } from "@/types";
import { resolveQuizType } from "@/utils/teamBuilding";
import { ClusterView } from "../ClusterView";
import { DiscussionResultsPanel } from "../DiscussionResultsPanel";

function toRuntimeQuestion(message: Extract<PeerMessage, { type: "questionStarted" }>): Question {
  if (message.question.type === "mcq") {
    return {
      ...message.question,
      correctChoiceIds: [],
    };
  }

  return message.question;
}

export function PlayerResultPage() {
  const session = useSessionStore((state) => state.session);
  const participantId = useSessionStore((state) => state.participantId);
  const lastPointsAwarded = useSessionStore((state) => state.lastPointsAwarded);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const startQuestion = useSessionStore((state) => state.startQuestion);
  const setCurrentQuestion = useSessionStore((state) => state.setCurrentQuestion);
  const currentQuestion = useSessionStore((state) => state.currentQuestion);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);
  const setSessionQuizType = useSessionStore((state) => state.setSessionQuizType);
  const setSessionState = useSessionStore((state) => state.setSessionState);
  const teamResultsSnapshot = useSessionStore((state) => state.teamResultsSnapshot);
  const setTeamResultsSnapshot = useSessionStore((state) => state.setTeamResultsSnapshot);

  const [displayedPoints, setDisplayedPoints] = useState(0);
  const isTeamBuilding = resolveQuizType(session?.quizType) === "team-building";

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;

  // Animate points
  useEffect(() => {
    if (isTeamBuilding) {
      return;
    }

    if (lastPointsAwarded > 0) {
      const duration = 500;
      const steps = 20;
      const increment = lastPointsAwarded / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= lastPointsAwarded) {
          setDisplayedPoints(lastPointsAwarded);
          clearInterval(interval);
        } else {
          setDisplayedPoints(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }
  }, [lastPointsAwarded, isTeamBuilding]);

  useEffect(() => {
    if (!playerPeer) {
      navigate("/join");
      return;
    }

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "questionStarted") {
        const runtimeQuestion = toRuntimeQuestion(message);
        setSessionQuizType(runtimeQuestion.type === "mcq" ? "standard" : "team-building");
        setCurrentQuestion(runtimeQuestion);
        startQuestion(
          message.questionIndex,
          runtimeQuestion,
          message.questionDuration,
          message.discussionIntroParticipantIds ?? []
        );
        navigate("/play/question");
      } else if (message.type === "teamResultsPublished") {
        setTeamResultsSnapshot({
          questionId: message.questionId,
          groupedAnswers: message.groupedAnswers ?? [],
          discussionQueue: message.discussionQueue ?? [],
        }, message.sessionState ?? "team-results");
        setSessionState(message.sessionState ?? "team-results");
      } else if (message.type === "sessionEnded") {
        updateLeaderboard(message.finalLeaderboard, 0);
        navigate("/play/final");
      }
    };
  }, [
    playerPeer,
    startQuestion,
    setCurrentQuestion,
    setSessionState,
    setSessionQuizType,
    updateLeaderboard,
    setTeamResultsSnapshot,
  ]);

  const leaderboard = getLeaderboard();
  const myEntry = leaderboard.find((e) => e.participantId === participantId);
  const myRank = myEntry?.rank || 0;
  const myScore = myEntry?.score || 0;
  const gotPoints = !isTeamBuilding && lastPointsAwarded > 0;
  const isDiscussionRound =
    isTeamBuilding &&
    currentQuestion?.type === "discussion" &&
    (session?.state === "team-discussion" || (teamResultsSnapshot?.discussionQueue.length ?? 0) > 0);
  const hasTeamInsights =
    isTeamBuilding &&
    teamResultsSnapshot !== null &&
    (teamResultsSnapshot.groupedAnswers.length > 0 ||
      teamResultsSnapshot.discussionQueue.length > 0);

  return (
    <div
      className={`container mx-auto px-4 py-8 min-h-screen overflow-y-auto flex flex-col ${
        isTeamBuilding ? "max-w-2xl justify-start" : "max-w-md justify-center"
      }`}
    >
      <div className="glass-card p-6 sm:p-8 text-center">
        {/* Result icon */}
        <div className="mb-6">
          {isTeamBuilding ? (
            <CheckCircle className="w-20 h-20 mx-auto text-[var(--color-action)]" />
          ) : gotPoints ? (
            <CheckCircle className="w-20 h-20 mx-auto text-[#10B981]" />
          ) : (
            <XCircle className="w-20 h-20 mx-auto text-[#F43F5E]" />
          )}
        </div>

        {/* Result text */}
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)] mb-2">
          {isTeamBuilding
            ? isDiscussionRound
              ? "Discussion time"
              : "Response received"
            : gotPoints
              ? "Correct!"
              : "Incorrect"}
        </h1>

        {!isTeamBuilding && (
          <div className="mb-8">
            <p className="text-[var(--text-secondary)] mb-2">Points earned</p>
            <p className="text-5xl font-heading font-bold text-[var(--text-primary)] count-up">
              +{displayedPoints}
            </p>
          </div>
        )}

        {isTeamBuilding && (
          <p className="text-[var(--text-secondary)] mb-8">
            {isDiscussionRound
              ? "Top-voted answers are ready. Discuss them with your team while the host guides the conversation."
              : "Thanks for contributing. The host is preparing the next activity."}
          </p>
        )}

        {!isTeamBuilding && (
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Your Rank</p>
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-[#F59E0B]" />
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  #{myRank}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total Score</p>
              <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {myScore.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Waiting indicator */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--text-secondary)]">
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span className="text-sm">
            {isDiscussionRound ? "Discussion in progress - waiting for host" : "Waiting for next question..."}
          </span>
        </div>
      </div>

      {hasTeamInsights && teamResultsSnapshot && (
        <div className="space-y-4 mt-4">
          {isDiscussionRound ? (
            <DiscussionResultsPanel items={teamResultsSnapshot.discussionQueue} title="Top selected answers" />
          ) : null}
          <ClusterView clusters={teamResultsSnapshot.groupedAnswers} title="Current grouped answers" maxItems={6} />
          {!isDiscussionRound && teamResultsSnapshot.discussionQueue.length > 0 ? (
            <DiscussionResultsPanel items={teamResultsSnapshot.discussionQueue} title="Current discussion queue" />
          ) : null}
        </div>
      )}
    </div>
  );
}
