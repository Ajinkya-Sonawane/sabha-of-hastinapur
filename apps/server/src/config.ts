import { DEFAULT_TIMERS, type GameTimers } from "@sabha/game-engine";

export interface ServerConfig {
  port: number;
  host: string;
  dev: boolean;
  serveWeb: boolean;
  webDir: string;
  databaseUrl?: string;
  cookieSecure: boolean;
  allowedOrigins: string[];
  timers: GameTimers;
}

function num(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const dev = env.NODE_ENV !== "production";
  return {
    port: num(env.PORT, 3000),
    host: env.HOST ?? "0.0.0.0",
    dev,
    serveWeb: env.SERVE_WEB !== "0",
    webDir: env.WEB_DIR ?? new URL("../../web", import.meta.url).pathname,
    databaseUrl: env.DATABASE_URL || undefined,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "1" : !dev,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    timers: {
      ROLE_REVEAL: num(env.TIMER_ROLE_REVEAL, DEFAULT_TIMERS.ROLE_REVEAL),
      NIGHT_ACTION: num(env.TIMER_NIGHT_ACTION, DEFAULT_TIMERS.NIGHT_ACTION),
      DISCUSSION: num(env.TIMER_DISCUSSION, DEFAULT_TIMERS.DISCUSSION),
      VOTING: num(env.TIMER_VOTING, DEFAULT_TIMERS.VOTING),
      SPECIAL_ELIMINATION: num(env.TIMER_SPECIAL_ELIMINATION, DEFAULT_TIMERS.SPECIAL_ELIMINATION),
      RESULTS: num(env.TIMER_RESULTS, DEFAULT_TIMERS.RESULTS),
      LOBBY_GRACE: num(env.TIMER_LOBBY_GRACE, DEFAULT_TIMERS.LOBBY_GRACE),
    },
  };
}
