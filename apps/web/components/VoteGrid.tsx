"use client";

import { useState } from "react";
import type { AvailableAction, PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { send } from "@/websocket/socket";
import { Countdown } from "./Countdown";
import { PlayerAvatar } from "./PlayerAvatar";
import { BottomActions, Button, ErrorText, Eyebrow, Screen, Title } from "./ui";

type VotePrompt = Extract<AvailableAction, { kind: "VOTE" }>;

export function Voting({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const prompt = me.availableActions.find((a): a is VotePrompt => a.kind === "VOTE");
  const voted = game.voting?.votedPlayerIds.length ?? 0;
  const total = game.players.length;

  if (!prompt) {
    const target = game.players.find((p) => p.id === me.voteTarget);
    return (
      <Screen className="items-center justify-center text-center">
        <div aria-hidden className="text-5xl">🔒</div>
        <Eyebrow>Vote locked</Eyebrow>
        {target && <Title>{target.displayName}</Title>}
        <p className="text-muted" aria-live="polite">
          Waiting for the Sabha… {voted}/{total}
        </p>
        {game.timer && <Countdown deadline={game.timer.deadline} size="sm" />}
      </Screen>
    );
  }
  return <VoteGrid game={game} prompt={prompt} voted={voted} total={total} />;
}

export function VoteGrid({ game, prompt, voted, total }: { game: PublicGameView; prompt: VotePrompt; voted: number; total: number }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const candidates = game.players.filter((p) => prompt.targets.includes(p.id));
  const chosen = candidates.find((p) => p.id === choice);

  if (confirming && chosen) {
    return (
      <Screen className="items-center justify-center text-center">
        <Eyebrow>Your vote</Eyebrow>
        <Title className="text-4xl uppercase">{chosen.displayName}</Title>
        <p className="text-muted">This cannot be changed.</p>
        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ack = await send("vote.cast", { targetPlayerId: chosen.id });
              setBusy(false);
              if (!ack.ok) setError(ack.message);
            }}
          >
            Confirm vote
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Back
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  return (
    <Screen>
      <header className="text-center">
        <Eyebrow>The Sabha will judge</Eyebrow>
        <Title className="mt-2">Who should be removed?</Title>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm text-muted">
          <Countdown deadline={prompt.deadline} size="sm" />
          <span aria-live="polite">{voted}/{total} voted</span>
        </div>
      </header>
      <ul role="radiogroup" aria-label="Players" className="flex flex-col gap-2">
        {candidates.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={choice === p.id}
              onClick={() => setChoice(p.id)}
              className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-4 text-left text-base ${choice === p.id ? "border-saffron bg-saffron/15" : "border-line bg-panel"}`}
            >
              <span aria-hidden className={choice === p.id ? "text-saffron" : "text-muted"}>{choice === p.id ? "◉" : "○"}</span>
              <PlayerAvatar player={p} size="sm" />
              <span className="flex-1 truncate">{p.displayName}</span>
            </button>
          </li>
        ))}
      </ul>
      <BottomActions>
        <Button disabled={!choice} onClick={() => setConfirming(true)}>
          Cast vote
        </Button>
      </BottomActions>
    </Screen>
  );
}
