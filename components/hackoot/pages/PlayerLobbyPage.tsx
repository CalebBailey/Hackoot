"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { navigate } from "../HackootApp";
import { Users, Wifi } from "lucide-react";
import { PlayerPeer } from "@/transport/peer";
import { PeerMessage, Question } from "@/types";

function toRuntimeQuestion(message: Extract<PeerMessage, { type: "questionStarted" | "rejoinAck" }> ) {
  if (!message.question) {
    return null;
  }

  if (message.question.type === "mcq") {
    return {
      ...message.question,
      correctChoiceIds: [],
    } as Question;
  }

  return message.question as Question;
}

export function PlayerLobbyPage() {
  const participantName = useSessionStore((state) => state.participantName);
  const participantId = useSessionStore((state) => state.participantId);
  const session = useSessionStore((state) => state.session);
  const startQuestion = useSessionStore((state) => state.startQuestion);
  const setCurrentQuestion = useSessionStore((state) => state.setCurrentQuestion);
  const updateLeaderboard = useSessionStore((state) => state.updateLeaderboard);
  const setHasAnsweredCurrentQuestion = useSessionStore((state) => state.setHasAnsweredCurrentQuestion);
  const setSessionState = useSessionStore((state) => state.setSessionState);
  const setSessionQuizType = useSessionStore((state) => state.setSessionQuizType);
  const setTeamVoteContext = useSessionStore((state) => state.setTeamVoteContext);
  const setTeamResultsSnapshot = useSessionStore((state) => state.setTeamResultsSnapshot);
  const setSessionParticipants = useSessionStore((state) => state.setSessionParticipants);

  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);

  const playerPeer = (window as any).__hackootPlayerPeer as PlayerPeer | undefined;

  useEffect(() => {
    if (!playerPeer) {
      navigate("/join");
      return;
    }

    playerPeer.onMessage = (message: PeerMessage) => {
      if (message.type === "lobbyUpdate") {
        setParticipants(message.participants);
        setSessionParticipants(
          message.participants.map((participant) => ({
            participantId: participant.id,
            name: participant.name,
          }))
        );
      } else if (message.type === "questionStarted") {
        const runtimeQuestion = toRuntimeQuestion(message);
        if (!runtimeQuestion) return;
        const runtimeQuizType = runtimeQuestion.type === "mcq" ? "standard" : "team-building";
        setSessionQuizType(runtimeQuizType);
        setSessionState(runtimeQuizType === "team-building" ? "team-submission" : "question");
        setCurrentQuestion(runtimeQuestion);
        startQuestion(
          message.questionIndex,
          runtimeQuestion,
          message.questionDuration,
          message.discussionIntroParticipantIds ?? []
        );
        navigate("/play/question");
      } else if (message.type === "rejoinAck" && message.participantId === participantId) {
        if (message.participants?.length) {
          setSessionParticipants(message.participants);
        }

        if (message.quizType) {
          setSessionQuizType(message.quizType);
        }

        // Restore the player to the correct point in the session
        if ((message.sessionState === "question" || message.sessionState === "team-submission") && message.question !== undefined) {
          const runtimeQuestion = toRuntimeQuestion(message);
          if (!runtimeQuestion) return;
          setHasAnsweredCurrentQuestion(message.answeredCurrentQuestion ?? false);
          setCurrentQuestion(runtimeQuestion);
          setSessionState(message.sessionState);
          startQuestion(
            message.questionIndex!,
            runtimeQuestion,
            message.questionDuration,
            message.discussionIntroParticipantIds ?? []
          );
          navigate("/play/question");
        } else if (message.sessionState === "team-voting") {
          if (message.teamVoteContext) {
            setTeamVoteContext(message.teamVoteContext);
          }
          setSessionState("team-voting");
          navigate("/play/voting");
        } else if (message.sessionState === "team-results" || message.sessionState === "team-discussion") {
          if (message.teamResultsSnapshot) {
            setTeamResultsSnapshot(message.teamResultsSnapshot);
          }
          setSessionState(message.sessionState);
          navigate("/play/result");
        } else if (
          message.sessionState === "reveal" ||
          message.sessionState === "leaderboard"
        ) {
          if (message.leaderboard) updateLeaderboard(message.leaderboard, message.score);
          navigate("/play/result");
        } else if (message.sessionState === "ended") {
          if (message.leaderboard) updateLeaderboard(message.leaderboard, 0);
          navigate("/play/final");
        }
        // sessionState === "lobby": already on this page, no action needed
      }
    };

    playerPeer.onDisconnect = () => {
      navigate("/join");
    };
  }, [
    playerPeer,
    startQuestion,
    setCurrentQuestion,
    setHasAnsweredCurrentQuestion,
    setSessionState,
    setSessionQuizType,
    setSessionParticipants,
    setTeamVoteContext,
    setTeamResultsSnapshot,
    updateLeaderboard,
    participantId,
  ]);

  if (!participantName) {
    navigate("/join");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md min-h-dvh flex flex-col justify-center">
      <div className="glass-card p-6 sm:p-8 text-center">
        {/* Status */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[var(--text-secondary)]">Connected</span>
        </div>

        {/* Welcome */}
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)] mb-2">
          Welcome, {participantName}!
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Waiting for the host to start the game...
        </p>

        {/* Animated waiting indicator */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Wifi className="w-16 h-16 text-[var(--color-action)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-[var(--color-action)]/30 border-t-[var(--color-action)] rounded-full animate-spin" />
            </div>
          </div>
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-secondary)]">
                {participants.length} player{participants.length !== 1 ? "s" : ""} joined
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="px-3 py-1 rounded-full bg-white/10 text-sm text-[var(--text-primary)]"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Room Code */}
        {session?.roomCode && (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">
            Room: <span className="font-mono">{session.roomCode}</span>
          </p>
        )}
      </div>
    </div>
  );
}
