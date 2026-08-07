"use client";

import { useState, useEffect } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { navigate } from "../HackootApp";
import { ArrowLeft, Gamepad2, AlertCircle, RefreshCw } from "lucide-react";
import { PlayerPeer, isWebRTCSupported } from "@/transport/peer";
import { generateUUID } from "@/lib/utils";
import { loadPlayerSession, savePlayerSession, clearPlayerSession, CachedPlayerSession } from "@/utils/playerSession";

interface JoinPageProps {
  initialRoomCode?: string;
}

export function JoinPage({ initialRoomCode }: JoinPageProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode || "");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webRTCSupported, setWebRTCSupported] = useState(true);
  const [cachedSession, setCachedSession] = useState<CachedPlayerSession | null>(null);

  const setParticipant = useSessionStore((state) => state.setParticipant);
  const setIsHost = useSessionStore((state) => state.setIsHost);
  const initSession = useSessionStore((state) => state.initSession);

  useEffect(() => {
    if (!isWebRTCSupported()) {
      setWebRTCSupported(false);
      setError("Your browser does not support WebRTC. Please use Chrome, Firefox, Safari, or Edge.");
    }

    const cached = loadPlayerSession();
    if (cached) {
      setCachedSession(cached);
      setRoomCode(cached.roomCode);
      setName(cached.name);
    }
  }, []);

  const handleJoin = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      setError("Please enter a valid 6-character room code");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    setError(null);
    setJoining(true);

    // Reuse the cached participantId when rejoining the same room so the host
    // recognises the player and resumes their score rather than creating a duplicate
    const upperRoomCode = roomCode.toUpperCase();
    const participantId =
      cachedSession?.roomCode === upperRoomCode ? cachedSession.participantId : generateUUID();

    const playerPeer = new PlayerPeer();

    playerPeer.onError = (err) => {
      setError(err);
      setJoining(false);
    };

    try {
      await playerPeer.connect(upperRoomCode, participantId, name.trim());

      savePlayerSession({ participantId, name: name.trim(), roomCode: upperRoomCode });

      // Store player peer and info
      (window as any).__hackootPlayerPeer = playerPeer;
      setParticipant(participantId, name.trim());
      setIsHost(false);
      initSession(generateUUID(), "", upperRoomCode, "standard");

      navigate("/play/lobby");
    } catch (err) {
      setError((err as Error).message);
      setJoining(false);
    }
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setRoomCode(value);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md min-h-screen flex flex-col justify-center">
      <div className="glass-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">
            Join Game
          </h1>
        </div>

        {/* Resume notice */}
        {cachedSession && cachedSession.roomCode === roomCode && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-[var(--color-action)]/10 border border-[var(--color-action)]/30 rounded-lg">
            <RefreshCw className="w-4 h-4 text-[var(--color-action)] flex-shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              Resuming previous session as <span className="font-medium text-[var(--text-primary)]">{cachedSession.name}</span>
            </p>
            <button
              onClick={() => {
                clearPlayerSession();
                setCachedSession(null);
                setName("");
              }}
              className="ml-auto text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              New player
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-[#F43F5E]/20 border border-[#F43F5E]/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-[#F43F5E] flex-shrink-0" />
            <p className="text-sm text-[#F43F5E]">{error}</p>
          </div>
        )}

        {/* Room Code */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Room Code
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={handleRoomCodeChange}
            placeholder="ABCD12"
            maxLength={6}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--color-action)] font-mono text-2xl text-center tracking-[0.15em] uppercase"
            autoFocus
          />
        </div>

        {/* Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--color-action)]"
          />
        </div>

        {/* Join Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleJoin}
          loading={joining}
          disabled={!roomCode || !name.trim() || !webRTCSupported}
        >
          <Gamepad2 className="w-5 h-5 mr-2" />
          Join Game
        </Button>
      </div>
    </div>
  );
}
