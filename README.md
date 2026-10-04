# Sabha of Hastinapur

A Mahabharata-inspired hidden-role party game for 5–10 players (in the style of One Night Ultimate Werewolf). Each player uses their own phone, and nothing needs to be installed. Phones handle secret information, night actions, voting and the reveal. The discussion happens face to face.

> **Players are people. Cards are identities.** A player's *starting* card decides their night action. Their *final* card, after every swap, decides their side and whether they won. All mythology-based mechanics are game adaptations, not claims about the epic.

## Quick start

```bash
npm install
npm run dev          # Next.js + Socket.IO on http://localhost:3000 (one origin)
npm test             # engine unit/interaction/e2e tests + socket integration tests
npm run typecheck
```

Production:

```bash
npm run build        # builds the Next.js client
npm start            # NODE_ENV=production; serves pages, /api and /socket.io on $PORT
```

To test several players on one machine, give each player a separate browser profile or incognito window. The session is an HttpOnly cookie, so tabs in the same profile share one seat.

### Configuration (env)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `DATABASE_URL` | — | Enables PostgreSQL persistence. Without it, state stays in memory (single server). |
| `COOKIE_SECURE` | on in production | `Secure` flag on the session cookie |
| `ALLOWED_ORIGINS` | same-origin | Comma-separated extra origins for the API and WebSocket |
| `SERVE_WEB` | `1` | Set to `0` to run the API/WebSocket without Next.js |
| `CLIENT_IP_HEADER` | — | Header a trusted edge sets to the visitor's IP, used for rate limits. On Render (behind Cloudflare) set `cf-connecting-ip`. Overrides `TRUST_PROXY` |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of the server. Set to `1` behind a host's load balancer so rate limits use the client IP from `X-Forwarded-For` |
| `MAX_ROOMS` | `500` | Live rooms allowed at once. New rooms get `SERVER_BUSY` (503) beyond this |
| `MAX_SOCKETS_PER_IP` | `30` | Concurrent WebSocket connections per client IP |
| `SOCKET_ROOMS` | on in dev | Allow `room.create` / `room.join` over the socket. Browsers use HTTP, so this is off in production |
| `TIMER_ROLE_REVEAL`, `TIMER_NIGHT_ACTION`, `TIMER_DISCUSSION`, `TIMER_VOTING`, `TIMER_SPECIAL_ELIMINATION`, `TIMER_LOBBY_GRACE` | 15, 30, 300, 30, 30, 120 | Phase timers, in seconds |

For PostgreSQL, run `DATABASE_URL=… npm run migrate -w @sabha/server`, which applies `apps/server/db/migrations`.

## Layout

```
packages/protocol      shared types, wire events, zod schemas, public role text (browser-safe)
packages/game-engine   deterministic engine: CardEngine, NightEngine, VotingEngine,
                       EliminationEngine, VictoryEngine, role registry (one file per role)
apps/server            HTTP API, Socket.IO gateway, RoomManager, sessions, persistence
apps/web               Next.js (App Router) + Tailwind + Zustand mobile client
```

Only the server imports `@sabha/game-engine`. The browser bundle imports `@sabha/protocol` only.

## Architecture notes

- **Server authority.** The engine is a pure reducer: `apply(state, command, now)` clones the state, validates the command, applies it, and checks the invariants from spec §85. Clients send intents such as "inspect player X". The server decides legality, results, vote weights and victory.
- **Public vs private.** Browsers get two things: `room.state` (names, connection, phase, timers, the deck composition, and results once the game has ended) and their own `player.private_state`. No other player's roles, centre cards, unresolved votes or night progress reach a browser before RESULTS. Tests assert this.
- **Cards move, not players.** Every swap goes through `swapPlayerCards`. `CardState` records the starting and current location of each card, and the append-only event log powers "What happened".
- **Concurrency and idempotency.** Commands for each room run in series. PostgreSQL writes lock the game row with `SELECT … FOR UPDATE` and check `state_version`. A repeated `requestId` within a phase is acknowledged without being applied again.
- **Timers** are server deadlines. Clients render them using a clock offset measured by ping/pong.
- **Reconnect.** The session cookie is sent with the socket handshake. The server replies with `session.restore` (public + private state). Missing night actions are auto-skipped, and missing votes count as abstentions.
- **Randomness** comes from `node:crypto` (`CryptoRandomSource`). Tests use `SeededRandomSource`.
- **Retention.** Completed games are deleted after 24h and event logs after 72h. Analytics are anonymous.

## Rule decisions where the spec left room

- **Night order:** Bhishma acts at priority **110**, not 180. At 180 he would act after every swapper, so his protection could never block Shakuni or Krishna (spec §57 requires that it does). The rest follows §56.
- **Knowledge roles** (Duryodhana, Shakuni, Dushasana, Karna) learn what they know when the roles are revealed. Ashwatthama wakes with no one.
- **Krishna** acts in two steps: `INSPECT_PAIR`, then `SWAP_OR_NOT` on the same pair. **Nakula** confirms his vision with `ACKNOWLEDGE`. **Gandhari** uses `CHOOSE_PLAYER`.
- **Swappers never learn** whether Bhishma blocked their swap.
- **Day abilities follow the final card.** Yudhishthira's double vote, Gandhari's vote rule, Bhima's and Ashwatthama's revenge, and Arjuna's arrow all belong to whoever holds that card at dawn. The arrow's target is the one the *starting* Arjuna chose.
- **Gandhari's vote for Duryodhana** is accepted but counts 0. Rejecting it would reveal who Duryodhana is.
- **Sanjaya** seals a blind prediction during his night turn and learns the true count at dawn. One move = one card changing location, so a swap is 2 moves.
- **Ties:** every tied highest-scoring player is removed. No votes at all means nobody is removed.
- **Draupadi:** `WITH_PANDAVAS` means Dharma roles plus Shikhandi. Everyone else is `AGAINST_PANDAVAS`.
- **Rematch** returns the table to the lobby with the same players, so new players can join before the host starts again.
- **Room create/join over the socket** binds only that connection. Browsers use the HTTP endpoints, because only HTTP can set the HttpOnly cookie that makes reconnect work.

## Game modes

| Mode | 5 players (8 cards) | Added one per player for 6 → 10 |
| --- | --- | --- |
| Beginner | Duryodhana, Shakuni, Yudhishthira, Bhima, Sahadeva, Krishna, Karna, Vidura | Dushasana, Bhishma, Drona, Arjuna, Draupadi |
| Standard | Duryodhana, Shakuni, Yudhishthira, Bhima, Sahadeva, Nakula, Krishna, Karna | Dushasana, Bhishma, Draupadi, Arjuna, Sanjaya |
| Advanced | Duryodhana, Shakuni, Yudhishthira, Bhima, Sahadeva, Krishna, Karna, Gandhari | Ashwatthama, Bhishma, Shikhandi, Nakula, Sanjaya |
