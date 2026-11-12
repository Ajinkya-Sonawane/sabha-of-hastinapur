"use client";

import { useState } from "react";
import { Faction, type PlayerId, type PrivatePlayerView, type PublicGameView } from "@sabha/protocol";
import { FACTION_PRESENTATION, ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { send } from "@/websocket/socket";
import { FactionBadge, FactionIcon } from "./FactionBadge";
import { RoleAvatar } from "./RoleCard";
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
        <Title className="text-4xl">{nameOf(id)}</Title>
        <p className="text-xs tracking-wide text-muted">Final identity</p>
        <div className="flex justify-center">
          <RoleAvatar role={r.finalRole} deck={game.deck} size="xl" />
        </div>
        <p className="font-serif text-[45px] leading-[52px] text-primary">{role.name}</p>
        <div className="flex justify-center">
          <FactionBadge faction={r.faction} />
        </div>
        <p className="text-xs tracking-wide text-muted">Status</p>
        <p className="font-semibold tracking-wide text-error">✗ Eliminated</p>
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
        {headlineFaction && (
          <div className="mb-2 flex justify-center">
            <FactionIcon faction={headlineFaction} className="h-12 w-12" />
          </div>
        )}
        <Title className="text-[36px] leading-[44px]">{results.headline.charAt(0) + results.headline.slice(1).toLowerCase()}</Title>
        {mine && (
          <p className={`mt-3 text-lg font-semibold ${mine.won ? "text-success" : "text-error"}`}>
            {mine.won ? "✓ You won" : "✗ You lost"} — {mine.reason}
          </p>
        )}
      </div>

      <Divider />
      <section aria-labelledby="final-ids">
        <h2 id="final-ids" className="mb-3 text-xs tracking-wide text-muted">Final identities</h2>
        <ul className="overflow-hidden rounded-xl bg-surface-container-high">
          {results.playerResults.map((r) => {
            const role = ROLE_PRESENTATION[r.finalRole];
            const moved = r.startingRole !== r.finalRole;
            return (
              <li key={r.playerId} className="flex min-h-[72px] items-center gap-4 border-b border-outline-variant px-4 py-2 last:border-b-0">
                <RoleAvatar role={r.finalRole} deck={game.deck} size="lg" />
                <span className={`order-last text-xl ${r.won ? "text-success" : "text-error"}`} aria-label={r.won ? "won" : "lost"}>
                  {r.won ? "✓" : "✗"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">
                    {nameOf(r.playerId)}
                    {r.eliminated && <span className="ml-2 text-xs tracking-wide text-error">removed</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {role.name}
                    {moved && <> · started as {ROLE_PRESENTATION[r.startingRole].name}</>}
                  </span>
                </span>
                <span role="img" aria-label={FACTION_PRESENTATION[r.faction].label}>
                  <FactionIcon faction={r.faction} />
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
        <h2 id="what-happened" className="mb-3 text-xs tracking-wide text-muted">What happened</h2>
        <ol className="flex flex-col gap-2 text-[15px] leading-snug">
          {[...night, ...votes].map((e, i) => (
            <li key={i} className="border-l-2 border-outline-variant pl-3">
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
