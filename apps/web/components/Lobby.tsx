"use client";

import { useState } from "react";
import type { PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { MODE_PRESENTATION } from "@sabha/protocol";
import { send } from "@/websocket/socket";
import { ConnectionDot } from "./ConnectionDot";
import { PlayerAvatar } from "./PlayerAvatar";
import { BottomActions, Button, Eyebrow, Panel, Screen } from "./ui";

export function Lobby({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = me.availableActions.find((a) => a.kind === "START_GAME");
  const empty = Math.max(0, game.capacity - game.players.length);
  const self = game.players.find((p) => p.id === me.playerId);

  async function copy() {
    const url = `${window.location.origin}/join?code=${game.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Sabha of Hastinapur", text: `Join my Sabha: ${game.roomCode}`, url });
      } else {
        await navigator.clipboard.writeText(game.roomCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Eyebrow>{me.isHost ? "Your Sabha" : "Sabha"}</Eyebrow>
        <ConnectionDot />
      </header>

      <div className="text-center">
        <p className="font-mono text-5xl font-semibold tracking-[0.18em] text-saffron" aria-label={`Room code ${game.roomCode.split("").join(" ")}`}>
          {game.roomCode}
        </p>
        <p className="mt-2 text-sm text-muted">Share this code with everyone.</p>
        <div className="mx-auto mt-3 max-w-[220px]">
          <Button variant="secondary" onClick={copy} className="min-h-[44px] text-sm">
            {copied ? "Copied ✓" : "Copy code"}
          </Button>
        </div>
      </div>

      <Panel className="flex flex-col gap-1">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Players</p>
          <p className="font-mono text-sm text-parchment">
            {game.players.length} / {game.capacity}
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {game.players.map((p) => (
            <li key={p.id} className="flex min-h-[48px] items-center gap-3">
              <PlayerAvatar player={p} />
              <span className="flex-1 truncate text-base">
                {p.displayName}
                {p.id === me.playerId && <span className="text-muted"> (you)</span>}
                {p.id === game.hostPlayerId && <span className="ml-2 text-xs uppercase tracking-widest text-gold">host</span>}
              </span>
              <span className={p.connected ? "text-emerald-400" : "text-kuru"} aria-label={p.connected ? "connected" : "disconnected"}>
                {p.connected ? "✓" : "…"}
              </span>
            </li>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} className="flex min-h-[48px] items-center gap-3 text-muted">
              <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-line">○</span>
              Waiting…
            </li>
          ))}
        </ul>
      </Panel>

      <p className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm leading-snug text-muted">
        <span className="font-semibold text-parchment">House rule:</span> if the vote ties, <em>every</em> tied player is removed.
        Mode: {MODE_PRESENTATION[game.mode].label}.
      </p>

      <BottomActions>
        {start && start.kind === "START_GAME" ? (
          <>
            <Button
              disabled={!start.enabled || busy}
              onClick={async () => {
                setBusy(true);
                await send("game.start");
                setBusy(false);
              }}
            >
              Start Sabha
            </Button>
            {!start.enabled && <p className="text-center text-sm text-muted">{start.reason}</p>}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center font-serif text-lg text-muted">Waiting for the host…</p>
            <Button variant={self?.ready ? "secondary" : "primary"} onClick={() => send("room.ready", { ready: !self?.ready })}>
              {self?.ready ? "Ready ✓" : "I'm ready"}
            </Button>
          </div>
        )}
        <Button variant="ghost" onClick={() => send("game.leave")}>
          Leave Sabha
        </Button>
      </BottomActions>
    </Screen>
  );
}
