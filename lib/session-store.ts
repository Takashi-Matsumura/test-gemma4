export interface Session {
  transcript: string;
  chunks: number;
  startedAt: number;
  lastUpdate: number;
}

const sessions = new Map<string, Session>();

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastUpdate > MAX_AGE_MS) {
        sessions.delete(id);
      }
    }
  }, 30 * 60 * 1000); // every 30 minutes
}

export function appendTranscript(sessionId: string, text: string): Session {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.transcript += text;
    existing.chunks += 1;
    existing.lastUpdate = Date.now();
    return existing;
  }
  const session: Session = {
    transcript: text,
    chunks: 1,
    startedAt: Date.now(),
    lastUpdate: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
