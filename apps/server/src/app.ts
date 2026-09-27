import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { GameEngine, type RandomSource } from "@sabha/game-engine";
import { Server as SocketServer } from "socket.io";
import type { ServerConfig } from "./config";
import { createApiHandler } from "./http/api";
import { MemoryAnalytics, PostgresAnalytics, type AnalyticsSink } from "./persistence/analytics";
import { InMemoryGameRepository, type GameRepository } from "./persistence/GameRepository";
import { PostgresGameRepository } from "./persistence/PostgresGameRepository";
import { RoomManager } from "./rooms/RoomManager";
import { SessionStore } from "./security/sessions";
import { GameGateway } from "./websocket/gateway";

export interface SabhaServer {
  http: HttpServer;
  io: SocketServer;
  rooms: RoomManager;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export interface CreateServerOptions {
  config: ServerConfig;
  repo?: GameRepository;
  analytics?: AnalyticsSink;
  rng?: RandomSource;
  clock?: () => number;
  /** Handles every non-API request (the Next.js app). */
  webHandler?: (req: IncomingMessage, res: ServerResponse) => unknown;
  webUpgrade?: (req: IncomingMessage, socket: Duplex, head: Buffer) => unknown;
}

export async function createSabhaServer(options: CreateServerOptions): Promise<SabhaServer> {
  const { config } = options;
  let repo = options.repo;
  let analytics = options.analytics;
  if (!repo) {
    if (config.databaseUrl) {
      const pg = new PostgresGameRepository(config.databaseUrl);
      repo = pg;
      analytics ??= new PostgresAnalytics(pg.pool);
    } else {
      repo = new InMemoryGameRepository();
    }
  }
  analytics ??= new MemoryAnalytics();

  const engine = new GameEngine({ timers: config.timers, rng: options.rng });
  const rooms = new RoomManager(engine, repo, new SessionStore(), analytics, options.clock);
  const restored = await rooms.restore();
  if (restored) console.log(`[sabha] restored ${restored} active game(s)`);
  rooms.startSweeper();

  const api = createApiHandler(rooms, config);
  const http = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (await api(req, res)) return;
    if (options.webHandler) return options.webHandler(req, res);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  const io = new SocketServer(http, {
    path: "/socket.io",
    serveClient: false,
    // Let Next.js handle its own upgrade requests (HMR) instead of destroying them.
    destroyUpgrade: false,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16_384,
  });
  new GameGateway(io, rooms, config);

  if (options.webUpgrade) {
    http.on("upgrade", (req, socket, head) => {
      if (req.url?.startsWith("/socket.io")) return;
      options.webUpgrade!(req, socket, head);
    });
  }

  return {
    http,
    io,
    rooms,
    listen: () =>
      new Promise((resolve) => {
        http.listen(config.port, config.host, () => {
          const address = http.address();
          resolve(typeof address === "object" && address ? address.port : config.port);
        });
      }),
    close: async () => {
      await rooms.shutdown();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await repo!.close();
    },
  };
}
