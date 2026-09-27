import { createHash, randomBytes, randomInt } from "node:crypto";
import type { GameId, PlayerId } from "@sabha/protocol";

export const SESSION_COOKIE = "sabha_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface SessionRecord {
  gameId: GameId;
  playerId: PlayerId;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only hashes are stored; a database leak does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Maps session token → player → game. Display names are never identity.
 */
export class SessionStore {
  private readonly byHash = new Map<string, SessionRecord>();

  issue(record: SessionRecord): { token: string; hash: string } {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    this.byHash.set(hash, record);
    return { token, hash };
  }

  restore(hash: string, record: SessionRecord): void {
    this.byHash.set(hash, record);
  }

  resolve(token: string | undefined): SessionRecord | null {
    if (!token) return null;
    return this.byHash.get(hashSessionToken(token)) ?? null;
  }

  hashFor(gameId: GameId, playerId: PlayerId): string | undefined {
    for (const [hash, record] of this.byHash) {
      if (record.gameId === gameId && record.playerId === playerId) return hash;
    }
    return undefined;
  }

  revokePlayer(gameId: GameId, playerId: PlayerId): void {
    for (const [hash, record] of this.byHash) {
      if (record.gameId === gameId && record.playerId === playerId) this.byHash.delete(hash);
    }
  }

  revokeGame(gameId: GameId): void {
    for (const [hash, record] of this.byHash) {
      if (record.gameId === gameId) this.byHash.delete(hash);
    }
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** Secure; HttpOnly; SameSite=Lax. The browser sends it with the WebSocket handshake. */
export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_DIGITS = "23456789";

/** Six characters, e.g. KURU42. Avoids easily confused glyphs. */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
  for (let i = 0; i < 2; i++) code += CODE_DIGITS[randomInt(CODE_DIGITS.length)];
  return code;
}
