"use client";

import { useState } from "react";
import { Faction, type PlayerId, type PrivatePlayerView, type PublicGameView } from "@sabha/protocol";
import { FACTION_PRESENTATION, ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { send } from "@/websocket/socket";
import { FactionBadge } from "./FactionBadge";
import { VoteReveal } from "./VoteReveal";
import { BottomActions, Button, Divider, Eyebrow, Screen, Title } from "./ui";

const HEADLINE_FACTION: Record<string, Faction | null> = {
  "DHARMA VICTORY": Faction.DHARMA,
  "KAURAVA VICTORY": Faction.KAURAVA,
};

export function Results({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const results = game.results!;
  const [stage, setStage] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.displayName ?? "Someone";
  const result = (id: string) => results.playerResults.find((r) => r.playerId === id)!;
  const fallen = results.eliminatedPlayerIds;
  const canRematch = me.availableActions.some((a) => a.kind === "REMATCH");

  // Stage 0: the vote. Stage 1: each fallen identity. Stage 2: everything.
  if (stage === 0 && game.resolution) {
    return (
      <Screen className="justify-center">
        <VoteReveal game={game} result={game.resolution.voteResult} />
        <BottomActions>
          <Button onClick={() => setStage(1)}>Continue</Button>
          <Button variant="ghost" onClick={() => setStage(2)}>Skip to results</Button>
        </BottomActions>
      </Screen>
    );
  }

  if (stage === 1) {
    if (fallen.length === 0) {
      return (
        <Screen className="justify-center text-center">
          <Eyebrow>No one falls</Eyebrow>
          <Title>The Sabha removed no one.</Title>
          <BottomActions>
            <Button onClick={() => setStage(2)}>See who won</Button>
          </BottomActions>
        </Screen>
      );
    }
    const id = fallen[revealIndex];
    const r = result(id);
    const role = ROLE_PRESENTATION[r.finalRole];
    return (
      <Screen className="justify-center text-center" key={id}>
        <Title className="text-4xl uppercase">{nameOf(id)}</Title>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Final identity</p>
        <p className="font-serif text-5xl uppercase text-saffron">
          <span aria-hidden>{role.icon} </span>
          {role.name}
        </p>
        <div className="flex justify-center">
          <FactionBadge faction={r.faction} />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Status</p>
        <p className="font-semibold uppercase tracking-[0.2em] text-kaurava">✗ Eliminated</p>
        <BottomActions>
          <Button onClick={() => (revealIndex + 1 < fallen.length ? setRevealIndex(revealIndex + 1) : setStage(2))}>
            {revealIndex + 1 < fallen.length ? "Next" : "Show everybody"}
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  const headlineFaction = HEADLINE_FACTION[results.headline];
  const mine = results.playerResults.find((r) => r.playerId === me.playerId);
  const night = results.explanation.filter((e) => e.kind === "NIGHT");
  const votes = results.explanation.filter((e) => e.kind === "VOTE" || e.kind === "ELIMINATION");

  return (
    <Screen>
      <Eyebrow className="text-center">The Sabha has spoken</Eyebrow>
      <div className="text-center">
        {headlineFaction && <p aria-hidden className="text-4xl">{FACTION_PRESENTATION[headlineFaction].icon}</p>}
        <Title className="text-4xl uppercase tracking-[0.06em]">{results.headline}</Title>
        {mine && (
          <p className={`mt-3 text-lg font-semibold ${mine.won ? "text-emerald-400" : "text-kaurava"}`}>
            {mine.won ? "✓ You won" : "✗ You lost"} — {mine.reason}
          </p>
        )}
      </div>

      <Divider />
      <section aria-labelledby="final-ids">
        <h2 id="final-ids" className="mb-3 text-xs uppercase tracking-[0.3em] text-muted">Final identities</h2>
        <ul className="flex flex-col gap-2">
          {results.playerResults.map((r) => {
            const role = ROLE_PRESENTATION[r.finalRole];
            const moved = r.startingRole !== r.finalRole;
            return (
              <li key={r.playerId} className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
                <span className={`text-lg ${r.won ? "text-emerald-400" : "text-kaurava"}`} aria-label={r.won ? "won" : "lost"}>
                  {r.won ? "✓" : "✗"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {nameOf(r.playerId)}
                    {r.eliminated && <span className="ml-2 text-xs uppercase tracking-widest text-kaurava">removed</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {role.icon} {role.name}
                    {moved && <> · started as {ROLE_PRESENTATION[r.startingRole].name}</>}
                  </span>
                </span>
                <span className="text-sm" aria-label={FACTION_PRESENTATION[r.faction].label}>
                  {FACTION_PRESENTATION[r.faction].icon}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Centre: {results.centerRoles.map((r) => ROLE_PRESENTATION[r].name).join(" · ")}
        </p>
      </section>

      <Divider />
      <section aria-labelledby="what-happened">
        <h2 id="what-happened" className="mb-3 text-xs uppercase tracking-[0.3em] text-muted">What happened</h2>
        <ol className="flex flex-col gap-2 text-[15px] leading-snug">
          {[...night, ...votes].map((e, i) => (
            <li key={i} className="border-l-2 border-gold/40 pl-3">
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <BottomActions>
        {canRematch ? (
          <Button onClick={() => send("game.rematch")}>Play again</Button>
        ) : (
          <p className="text-center text-sm text-muted">Waiting for the host to begin another round…</p>
        )}
        <Button variant="ghost" onClick={() => setStage(0)}>
          Replay the reveal
        </Button>
      </BottomActions>
    </Screen>
  );
}

export type { PlayerId };
