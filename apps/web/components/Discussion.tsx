"use client";

import { useState } from "react";
import type { PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { send } from "@/websocket/socket";
import { Countdown } from "./Countdown";
import { KnowledgeList } from "./KnowledgeList";
import { RoleCard } from "./RoleCard";
import { BottomActions, Button, Eyebrow, Panel, Screen, Title } from "./ui";

export function Discussion({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const [peek, setPeek] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const canEnd = me.availableActions.some((a) => a.kind === "END_DISCUSSION");

  return (
    <Screen>
      <header className="text-center">
        <Eyebrow>☀️ The Sabha opens</Eyebrow>
        <Title className="mt-2">Everyone may speak.</Title>
      </header>

      <Panel>
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted">Discuss</p>
        <ul className="flex flex-col gap-1 font-serif text-lg">
          <li>— Who are you?</li>
          <li>— What did you see?</li>
          <li>— Who do you trust?</li>
          <li>— Who is lying?</li>
        </ul>
      </Panel>

      {game.timer && <Countdown deadline={game.timer.deadline} size="lg" />}
      <p className="text-center text-sm uppercase tracking-[0.3em] text-muted">Put your phone down.</p>

      <details className="rounded-2xl border border-line bg-panel/60 px-4 py-3">
        <summary className="cursor-pointer text-sm uppercase tracking-[0.2em] text-muted">Cards in this Sabha ({game.deck.length})</summary>
        <p className="mt-2 text-[15px] leading-relaxed">
          {game.deck.map((r) => ROLE_PRESENTATION[r].name).join(" · ")}
        </p>
        <p className="mt-2 text-xs text-muted">{game.players.length} are held by players, 3 lie in the centre.</p>
      </details>

      <BottomActions>
        {peek && me.startingRole && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-xs uppercase tracking-[0.3em] text-muted">You started as</p>
            <RoleCard role={me.startingRole} deck={game.deck} compact />
            <KnowledgeList items={me.knownInformation} players={game.players} meId={me.playerId} />
          </div>
        )}
        <Button variant="secondary" onClick={() => setPeek((v) => !v)} aria-expanded={peek}>
          {peek ? "Hide my secrets" : "Show my secrets"}
        </Button>
        {canEnd &&
          (confirming ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
              <Button onClick={() => send("discussion.end")}>Vote now</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)}>End discussion</Button>
          ))}
      </BottomActions>
    </Screen>
  );
}
