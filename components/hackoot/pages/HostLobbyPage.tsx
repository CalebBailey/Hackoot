"use client";

import { useEffect, useRef, useState } from "react";
import { useQuizStore } from "@/store/quizStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { RoomCodeDisplay } from "../RoomCodeDisplay";
import { QrCode } from "../QrCode";
import { navigate } from "../HackootApp";
import { ArrowLeft, Play, Users, AlertCircle } from "lucide-react";
import { generateRoomCode } from "@/utils/roomCode";
import { generateUUID } from "@/lib/utils";
import { HostPeer, isWebRTCSupported } from "@/transport/peer";
import { PeerMessage } from "@/types";
import { sanitizeQuestionTimeLimit } from "@/utils/scoring";
import { resolveQuizType } from "@/utils/teamBuilding";

interface HostLobbyPageProps {
  quizId: string;
}

export function HostLobbyPage({ quizId }: HostLobbyPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const quiz = getQuizById(quizId);

  const session = useSessionStore((state) => state.session);
  const initSession = useSessionStore((state) => state.initSession);
  const setIsHost = useSessionStore((state) => state.setIsHost);
  const addParticipant = useSessionStore((state) => state.addParticipant);
  const peerError = useSessionStore((state) => state.peerError);
  const setPeerError = useSessionStore((state) => state.setPeerError);

  const hostPeerRef = useRef<HostPeer | null>(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    if (!quiz) {
      navigate("/");
      return;
    }

    // Check WebRTC support before attempting to connect
    if (!isWebRTCSupported()) {
      setPeerError("Your browser does not support WebRTC. Please use Chrome, Firefox, Safari, or Edge.");
      setConnecting(false);
      return;
    }

    const roomCode = generateRoomCode();
    const sessionId = generateUUID();
    const quizType = resolveQuizType(quiz.quizType);

    initSession(sessionId, quizId, roomCode, quizType);
    setIsHost(true);

    const hostPeer = new HostPeer();
    hostPeerRef.current = hostPeer;

    hostPeer.onPlayerJoin = (participantId, name) => {
      const storeState = useSessionStore.getState();
      const existingParticipant = storeState.session?.participants.find(
        (p) => p.participantId === participantId
      ) ?? null;

      if (!existingParticipant) {
        addParticipant({
          participantId,
          name,
          score: 0,
          answeredCurrentQuestion: false,
        });
      }

      // Broadcast updated lobby to all players
      const updatedSession = useSessionStore.getState().session;
      if (updatedSession) {
        hostPeer.broadcast({
          type: "lobbyUpdate",
          participants: updatedSession.participants.map((p) => ({
            id: p.participantId,
            name: p.name,
          })),
        });
      }

      // If this is a mid-game rejoin, send the current state so the player
      // can navigate to the right page without waiting for the next broadcast
      if (existingParticipant && updatedSession && updatedSession.state !== "lobby") {
        const qIdx = updatedSession.currentQuestionIndex;
        const currentQuestion = qIdx !== null ? quiz?.questions[qIdx] : null;
        const leaderboard = useSessionStore.getState().getLeaderboard();
        const storeSnapshot = useSessionStore.getState();
        const publicQuestion = currentQuestion
          ? currentQuestion.type === "mcq"
            ? (({ correctChoiceIds, ...question }) => question)(currentQuestion)
            : currentQuestion
          : undefined;

        const rejoinMsg: PeerMessage = {
          type: "rejoinAck",
          participantId,
          sessionState: updatedSession.state,
          quizType: updatedSession.quizType,
          score: existingParticipant.score,
          participants: updatedSession.participants.map((participant) => ({
            participantId: participant.participantId,
            name: participant.name,
          })),
          leaderboard,
          ...((updatedSession.state === "question" || updatedSession.state === "team-submission") && currentQuestion
            ? {
                question: publicQuestion,
                questionIndex: qIdx!,
                totalQuestions: quiz?.questions.length ?? 0,
                questionDuration: sanitizeQuestionTimeLimit(currentQuestion.timeLimit),
                answeredCurrentQuestion: existingParticipant.answeredCurrentQuestion,
                discussionIntroParticipantIds: storeSnapshot.discussionIntroParticipantIds,
              }
            : {}),
          ...(updatedSession.state === "team-voting" && storeSnapshot.teamVoteContext
            ? {
                teamVoteContext: storeSnapshot.teamVoteContext,
              }
            : {}),
          ...((updatedSession.state === "team-results" || updatedSession.state === "team-discussion") && storeSnapshot.teamResultsSnapshot
            ? {
                teamResultsSnapshot: storeSnapshot.teamResultsSnapshot,
              }
            : {}),
        };

        hostPeer.broadcast(rejoinMsg);
      }
    };

    hostPeer.onError = (error) => {
      setPeerError(error);
      setConnecting(false);
    };

    hostPeer.connect(roomCode)
      .then(() => {
        setConnecting(false);
      })
      .catch((err) => {
        setPeerError(err.message);
        setConnecting(false);
      });

    // Store peer in window for access in other pages
    (window as any).__hackootHostPeer = hostPeer;

    return () => {
      // Don't disconnect here - we need the peer for the game
    };
  }, [quiz, quizId, initSession, setIsHost, addParticipant, setPeerError]);

  const handleStartQuiz = () => {
    if (session && session.participants.length > 0) {
      navigate(`/host/${quizId}/question`);
    }
  };

  const handleBack = () => {
    hostPeerRef.current?.disconnect();
    (window as any).__hackootHostPeer = null;
    navigate("/");
  };

  if (!quiz) {
    return null;
  }

  if (peerError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[#F43F5E]" />
          <h2 className="text-xl font-heading font-bold text-[var(--text-primary)] mb-2">
            Connection Error
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">{peerError}</p>
          <Button variant="primary" onClick={handleBack}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (connecting || !session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="glass-card p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-[var(--color-action)] rounded-full mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Setting up room...</p>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${session.roomCode}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg glass-card hover:bg-white/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text-primary)]">
            {quiz.title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {quiz.questions.length} questions - {resolveQuizType(quiz.quizType) === "team-building" ? "Team Building" : "Standard"}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col sm:flex-row gap-6 items-stretch">

        {/* Left: Room Code & QR (1/3) */}
        <div className="glass-card p-6 sm:p-8 text-center flex flex-col justify-center sm:w-1/2">
          <p className="text-[var(--text-secondary)] mb-2">Join at</p>
          <p className="text-lg font-medium text-[var(--text-primary)] mb-4">
            {window.location.host}
          </p>
          <div className="flex justify-center mb-6">
            <RoomCodeDisplay code={session.roomCode} />
          </div>
          <div className="flex justify-center">
            <QrCode value={joinUrl} size={180} />
          </div>
        </div>

        {/* Right: Players + Start button (2/3) */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Participants */}
          <div className="glass-card p-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[var(--text-secondary)]" />
              <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)]">
                Players ({session.participants.length})
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {session.participants.length === 0 ? (
                <p className="text-[var(--text-secondary)] text-center py-4">
                  Waiting for players to join...
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {session.participants.map((participant) => (
                    <span
                      key={participant.participantId}
                      className="px-3 py-1.5 rounded-full bg-white/10 text-[var(--text-primary)] text-sm font-medium fade-in"
                    >
                      {participant.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Start Button */}
          <div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleStartQuiz}
              disabled={session.participants.length === 0}
            >
              <Play className="w-5 h-5 mr-2" />
              Start Quiz
            </Button>
            {session.participants.length === 0 && (
              <p className="text-center text-sm text-[var(--text-secondary)] mt-2">
                At least 1 player required to start
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
