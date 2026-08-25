"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "../Button";
import { navigate } from "../HackootApp";
import { Trophy, Download, Home, Medal, FileText } from "lucide-react";
import {
  exportSessionResults,
  exportSessionResultsPdf,
  SessionExportData,
} from "@/utils/quizStorage";
import {
  clearPlayerResumeTarget,
  clearPlayerSession,
  loadPlayerSession,
  savePlayerResumeTarget,
} from "@/utils/playerSession";
import { resolveQuizType } from "@/utils/teamBuilding";
import { InterestMatchGraph } from "../InterestMatchGraph";
import { PlayerPeer } from "@/transport/peer";
import { generateUUID } from "@/lib/utils";

// Delays (ms) for each place to begin animating - 3rd first, 2nd second, 1st last
const PODIUM_DELAYS = { third: 0, second: 700, first: 1400 };
// How long after the bar starts before the card appears
const CARD_AFTER_BAR = 550;

export function FinalLeaderboardPage() {
  const session = useSessionStore((state) => state.session);
  const isHost = useSessionStore((state) => state.isHost);
  const participantId = useSessionStore((state) => state.participantId);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const setParticipant = useSessionStore((state) => state.setParticipant);
  const setIsHost = useSessionStore((state) => state.setIsHost);
  const initSession = useSessionStore((state) => state.initSession);
  const reset = useSessionStore((state) => state.reset);
  const getQuizById = useQuizStore((state) => state.getQuizById);

  const [thirdVisible, setThirdVisible] = useState(false);
  const [secondVisible, setSecondVisible] = useState(false);
  const [firstVisible, setFirstVisible] = useState(false);
  const [thirdCardVisible, setThirdCardVisible] = useState(false);
  const [secondCardVisible, setSecondCardVisible] = useState(false);
  const [firstCardVisible, setFirstCardVisible] = useState(false);
  const [isRejoiningSession, setIsRejoiningSession] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const leaderboard = getLeaderboard();
  const isTeamBuilding = resolveQuizType(session?.quizType) === "team-building";
  const quizTitle = session
    ? getQuizById(session.quizId)?.title ?? session.quizId ?? "hackoot-results"
    : "hackoot-results";

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setThirdVisible(true), PODIUM_DELAYS.third));
    timers.push(setTimeout(() => setThirdCardVisible(true), PODIUM_DELAYS.third + CARD_AFTER_BAR));
    timers.push(setTimeout(() => setSecondVisible(true), PODIUM_DELAYS.second));
    timers.push(setTimeout(() => setSecondCardVisible(true), PODIUM_DELAYS.second + CARD_AFTER_BAR));
    timers.push(setTimeout(() => setFirstVisible(true), PODIUM_DELAYS.first));
    timers.push(setTimeout(() => setFirstCardVisible(true), PODIUM_DELAYS.first + CARD_AFTER_BAR));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (session || isHost || (window as any).__hackootPlayerPeer) {
      return;
    }

    const cachedSession = loadPlayerSession();
    if (!cachedSession) {
      return;
    }

    let active = true;
    setRejoinError(null);
    setIsRejoiningSession(true);

    const playerPeer = new PlayerPeer();
    playerPeer.onError = (errorMessage) => {
      if (!active) {
        return;
      }

      setRejoinError(errorMessage);
      setIsRejoiningSession(false);
    };

    playerPeer
      .connect(cachedSession.roomCode, cachedSession.participantId, cachedSession.name)
      .then(() => {
        if (!active) {
          playerPeer.disconnect();
          return;
        }

        (window as any).__hackootPlayerPeer = playerPeer;
        setParticipant(cachedSession.participantId, cachedSession.name);
        setIsHost(false);
        initSession(generateUUID(), "", cachedSession.roomCode, "standard");
        setIsRejoiningSession(false);
        savePlayerResumeTarget("play/final");
        navigate("/play/lobby");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        clearPlayerResumeTarget();
        setRejoinError((error as Error).message);
        setIsRejoiningSession(false);
      });

    return () => {
      active = false;
    };
  }, [initSession, isHost, session, setIsHost, setParticipant]);

  const buildSessionExportPayload = (): SessionExportData | null => {
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      roomCode: session.roomCode,
      quizType: resolveQuizType(session.quizType),
      quizTitle,
      participants: session.participants,
      answers: session.answers,
      leaderboard,
      teamClusters: session.teamClusters,
      teamDiscussionQueue: session.teamDiscussionQueue,
      teamQuestionPrompts: session.teamQuestionPrompts,
      endedAt: new Date().toISOString(),
    };
  };

  const handleDownloadJson = () => {
    const payload = buildSessionExportPayload();
    if (!payload) {
      return;
    }

    exportSessionResults(payload, quizTitle);
  };

  const handleDownloadPdf = async () => {
    const payload = buildSessionExportPayload();
    if (!payload || exportingPdf) {
      return;
    }

    setExportingPdf(true);
    try {
      await exportSessionResultsPdf(payload, quizTitle);
    } catch {
      window.alert("Unable to generate the PDF report right now. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePlayAgain = () => {
    const hostPeer = (window as any).__hackootHostPeer;
    const playerPeer = (window as any).__hackootPlayerPeer;
    hostPeer?.disconnect();
    playerPeer?.disconnect();
    (window as any).__hackootHostPeer = null;
    (window as any).__hackootPlayerPeer = null;
    clearPlayerSession();
    clearPlayerResumeTarget();
    reset();
    navigate("/");
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const totalResponses = session?.answers.length ?? 0;

  if (!session && isRejoiningSession) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md min-h-screen flex flex-col justify-center">
        <div className="glass-card p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-[var(--color-action)] rounded-full mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Reconnecting to session...</p>
        </div>
      </div>
    );
  }

  if (!session && rejoinError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md min-h-screen flex flex-col justify-center">
        <div className="glass-card p-8 text-center">
          <p className="text-[var(--text-secondary)] mb-4">{rejoinError}</p>
          <Button variant="primary" onClick={() => navigate("/join")}>Rejoin Game</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-[#F59E0B]" />
        <h1 className="text-3xl sm:text-4xl font-heading font-bold text-[var(--text-primary)]">
          {isTeamBuilding ? "Session Summary" : "Final Results"}
        </h1>
      </div>

      {isTeamBuilding ? (
        <div className="glass-card p-6 mb-8">
          <p className="text-[var(--text-secondary)] mb-4">
            Team Building session complete.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Participants</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{session?.participants.length ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Total responses</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{totalResponses}</p>
            </div>
          </div>

          {session?.participants.length ? (
            <div className="mt-5 space-y-2">
              {session.participants.map((participant) => (
                <div
                  key={participant.participantId}
                  className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[var(--text-primary)]"
                >
                  {participant.name}
                </div>
              ))}
            </div>
          ) : null}

          {session?.participants.length ? (
            <div className="mt-6">
              <InterestMatchGraph
                participants={session.participants}
                clustersByQuestion={session.teamClusters}
                questionPrompts={session.teamQuestionPrompts}
                currentParticipantId={participantId}
                title="People you matched with"
                maxVisibleMatches={6}
              />
            </div>
          ) : null}
        </div>
      ) : (
        /* Podium - rendered in visual order: 2nd | 1st | 3rd, but 3rd animates first */
        top3.length > 0 && (
        <div className="flex justify-center items-end gap-3 sm:gap-5 mb-8">

          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center w-24 sm:w-28">
              <div
                className={`glass-card p-4 text-center w-full mb-2 ${secondCardVisible ? "podium-card-animate" : ""}`}
                style={!secondCardVisible ? { opacity: 0 } : undefined}
              >
                <Medal className="w-7 h-7 text-gray-300 mx-auto" />
                <p className="font-semibold text-[var(--text-primary)] mt-2 text-sm truncate">
                  {top3[1].name}
                </p>
                <p className="text-xs font-mono text-[var(--text-secondary)]">
                  {top3[1].score.toLocaleString()}
                </p>
              </div>
              <div
                className={`w-full h-20 bg-gray-400/25 rounded-t-lg podium-bar ${secondVisible ? "podium-bar-animate" : ""}`}
              />
            </div>
          )}

          {/* 1st place - tallest, most exaggerated */}
          {top3[0] && (
            <div className="flex flex-col items-center w-28 sm:w-32">
              <div
                className={`glass-card p-5 text-center w-full mb-2 ${firstCardVisible ? "podium-card-animate-first-winner" : ""} ${participantId === top3[0].participantId ? "ring-2 ring-[var(--color-action)]" : ""}`}
                style={!firstCardVisible ? { opacity: 0 } : undefined}
              >
                <Trophy className="w-9 h-9 text-[#F59E0B] mx-auto" />
                <p className="font-bold text-[var(--text-primary)] mt-2 truncate">
                  {top3[0].name}
                </p>
                <p className="text-lg font-mono font-bold text-[#F59E0B]">
                  {top3[0].score.toLocaleString()}
                </p>
              </div>
              <div
                className={`w-full h-32 bg-[#F59E0B]/30 rounded-t-lg podium-bar ${firstVisible ? "podium-bar-animate-first" : ""}`}
              />
            </div>
          )}

          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center w-24 sm:w-28">
              <div
                className={`glass-card p-4 text-center w-full mb-2 ${thirdCardVisible ? "podium-card-animate" : ""}`}
                style={!thirdCardVisible ? { opacity: 0 } : undefined}
              >
                <Medal className="w-6 h-6 text-amber-700 mx-auto" />
                <p className="font-semibold text-[var(--text-primary)] mt-2 text-sm truncate">
                  {top3[2].name}
                </p>
                <p className="text-xs font-mono text-[var(--text-secondary)]">
                  {top3[2].score.toLocaleString()}
                </p>
              </div>
              <div
                className={`w-full h-14 bg-amber-700/25 rounded-t-lg podium-bar ${thirdVisible ? "podium-bar-animate" : ""}`}
              />
            </div>
          )}

        </div>
        )
      )}

      {/* Rest of leaderboard */}
      {!isTeamBuilding && rest.length > 0 && (
        <div className="glass-card p-4 mb-8">
          <div className="space-y-2">
            {rest.map((entry) => (
              <div
                key={entry.participantId}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.participantId === participantId
                    ? "bg-white/10 border-l-4 border-[var(--color-action)]"
                    : "bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                    {entry.rank}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-[var(--text-secondary)]">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isHost && (
          <Button variant="secondary" onClick={handleDownloadJson} className="flex-1">
            <Download className="w-5 h-5 mr-2" />
            Export JSON
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleDownloadPdf}
          className="flex-1"
          disabled={exportingPdf}
        >
          <FileText className="w-5 h-5 mr-2" />
          {exportingPdf ? "Preparing PDF..." : "Export PDF Report"}
        </Button>
        <Button variant="primary" onClick={handlePlayAgain} className="flex-1">
          <Home className="w-5 h-5 mr-2" />
          Play Again
        </Button>
      </div>
    </div>
  );
}
