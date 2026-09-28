"use client";

import { useState } from "react";
import type { PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { send } from "@/websocket/socket";
import { Countdown } from "./Countdown";
import { KnowledgeList } from "./KnowledgeList";
import { RoleCard } from "./RoleCard";
import { BottomActions, Button, Eyebrow, Screen, Title } from "./ui";

export function RoleReveal({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const [revealed, setRevealed] = useState(false);
  const confirm = me.availableActions.find((a) => a.kind === "CONFIRM_ROLE");
  const total = game.players.length;
  const ready = game.roleReveal?.confirmedCount ?? 0;

  if (!me.startingRole) return null;

  if (!revealed) {
    return (
      <Screen className="items-center justify-center text-center">
        <Eyebrow>The Sabha has chosen you</Eyebrow>
        <Title>Tap to reveal your identity.</Title>
        <p className="text-muted">Shield your screen from the players beside you.</p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 flex h-56 w-40 items-center justify-center rounded-[24px] border-2 border-gold/60 bg-[repeating-linear-gradient(45deg,rgba(217,180,90,0.08)_0_10px,transparent_10px_20px)] font-serif text-xl uppercase tracking-[0.2em] text-gold shadow-lg transition active:scale-95"
          aria-label="Reveal your identity"
        >
          Reveal
        </button>
        {game.timer && <Countdown deadline={game.timer.deadline} size="sm" />}
        {!confirm && <p className="text-sm text-muted">You are ready. {ready}/{total} ready.</p>}
      </Screen>
    );
  }

  return (
    <Screen>
      <RoleCard role={me.startingRole} deck={game.deck} />
      <KnowledgeList items={me.knownInformation} players={game.players} meId={me.playerId} />
      <BottomActions>
        {confirm ? (
          <Button onClick={() => send("role.confirm")}>I know who I am</Button>
        ) : (
          <p className="text-center text-sm text-muted">
            Waiting for the Sabha — {ready}/{total} ready
          </p>
        )}
        <Button variant="secondary" onClick={() => setRevealed(false)}>
          Hide identity
        </Button>
      </BottomActions>
    </Screen>
  );
}
