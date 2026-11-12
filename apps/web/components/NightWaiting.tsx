"use client";

import { useState } from "react";
import type { PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { KnowledgeList } from "./KnowledgeList";
import { RoleCard } from "./RoleCard";
import { BottomActions, Button, Eyebrow, Screen, Title } from "./ui";

/** Shown to everyone without a pending action. Never hints at who is acting. */
export function NightWaiting({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const [done, setDone] = useState(me.nightActionSubmitted);
  const [peek, setPeek] = useState(false);

  if (done && me.nightActionSubmitted) {
    const learned = me.knownInformation.filter((k) => k.source === me.startingRole);
    return (
      <Screen>
        <Eyebrow className="text-center">🌙 Night</Eyebrow>
        <Title className="text-center">Your action is complete.</Title>
        <KnowledgeList items={learned} players={game.players} meId={me.playerId} title="What you know" />
        <p className="text-center text-muted">Return to the Sabha.</p>
        <BottomActions>
          <Button variant="secondary" onClick={() => setDone(false)}>
            Hide
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  return (
    <Screen className="items-center justify-center text-center">
      <div aria-hidden className="text-6xl animate-glow">🌙</div>
      <Eyebrow>Night</Eyebrow>
      <Title>Your eyes are closed.</Title>
      <p className="font-serif text-lg text-muted">The Sabha is in darkness.</p>
      <p className="text-sm tracking-wide text-muted animate-glow" aria-live="polite">
        Waiting…
      </p>
      <BottomActions>
        {peek && me.startingRole && (
          <div className="flex flex-col gap-3 text-left">
            <RoleCard role={me.startingRole} deck={game.deck} compact />
            <KnowledgeList items={me.knownInformation} players={game.players} meId={me.playerId} />
          </div>
        )}
        <Button variant="ghost" onClick={() => setPeek((v) => !v)} aria-expanded={peek}>
          {peek ? "Hide my card" : "Peek at my card"}
        </Button>
      </BottomActions>
    </Screen>
  );
}
