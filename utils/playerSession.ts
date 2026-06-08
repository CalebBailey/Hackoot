const SESSION_KEY = "hackoot_player_session";

export interface CachedPlayerSession {
  participantId: string;
  name: string;
  roomCode: string;
}

export function savePlayerSession(data: CachedPlayerSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable in some private-browsing environments
  }
}

export function loadPlayerSession(): CachedPlayerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
