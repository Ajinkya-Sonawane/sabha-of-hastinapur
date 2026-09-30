import { createSabhaServer } from "./app";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig();
  let webHandler;
  let webUpgrade;

  if (config.serveWeb) {
    // One origin for pages, API and WebSocket keeps the session cookie simple.
    const { default: next } = await import("next");
    const app = next({ dev: config.dev, dir: config.webDir, hostname: "localhost", port: config.port });
    await app.prepare();
    webHandler = app.getRequestHandler();
    webUpgrade = app.getUpgradeHandler?.();
  }

  const server = await createSabhaServer({ config, webHandler, webUpgrade });
  const port = await server.listen();
  console.log(`[sabha] listening on http://localhost:${port} (${config.dev ? "dev" : "production"}${config.databaseUrl ? ", postgres" : ", in-memory"})`);

  const shutdown = async () => {
    console.log("[sabha] shutting down");
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // One stray rejection must not take down every live game on the server.
  process.on("unhandledRejection", (reason) => console.error("[sabha] unhandled rejection", reason));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
