import type { GameMode, RoomSummaryResponse, SessionResponse } from "@sabha/protocol";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("NETWORK", "Could not reach the Sabha. Check your connection.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Something went wrong.");
  return body as T;
}

export function createGame(playerName: string, playerCount: number, mode: GameMode) {
  return request<SessionResponse>("/api/games", { method: "POST", body: JSON.stringify({ playerName, playerCount, mode }) });
}

export function joinGame(roomCode: string, playerName: string) {
  return request<SessionResponse>(`/api/games/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    body: JSON.stringify({ playerName }),
  });
}

export function getRoom(roomCode: string) {
  return request<RoomSummaryResponse & { seated: boolean }>(`/api/games/${encodeURIComponent(roomCode)}`);
}
