"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AvailableAction,
  CenterSlot,
  MovementCountGuess,
  NightActionInput,
  NightActionOption,
  PlayerId,
  PrivatePlayerView,
  PublicGameView,
  RoleId,
} from "@sabha/protocol";
import { ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { send } from "@/websocket/socket";
import { Countdown } from "./Countdown";
import { KnowledgeList } from "./KnowledgeList";
import { PlayerAvatar } from "./PlayerAvatar";
import { RoleAvatar, RoleCard } from "./RoleCard";
import { BottomActions, Button, ErrorText, Eyebrow, Screen, Title } from "./ui";

type NightPrompt = Extract<AvailableAction, { kind: "NIGHT_ACTION" }>;

const MODE_LABELS: Partial<Record<NightActionOption["type"], string>> = {
  INSPECT_PLAYER: "Inspect player",
  INSPECT_CENTER: "Inspect centre",
};

function instruction(role: RoleId, option: NightActionOption): string {
  switch (option.type) {
    case "SWAP_PLAYERS":
      return "Choose TWO players. Their cards will be swapped — you will not see them.";
    case "INSPECT_PAIR":
      return "Choose TWO players to read their factions.";
    case "INSPECT_PLAYER":
      if (role === "DRAUPADI") return "Choose ONE player to learn whether they stand with the Pandavas right now.";
      if (role === "VIDURA") return "Choose ONE player: are they Pandava, Kaurava or Other?";
      if (role === "DRONA") return "Choose ONE player to learn who trained them.";
      return "Choose ONE player to see their card.";
    case "INSPECT_CENTER":
      return "Choose TWO of the centre cards to look at.";
    case "PROTECT_PLAYER":
      return "Choose ONE player to shield from every swap tonight.";
    case "ARROW_TARGET":
      return "Choose the target of your arrow. If you fall, it flies.";
    case "CHOOSE_PLAYER":
      return "Choose ONE player. They will learn that Gandhari chose them.";
    case "PREDICT_MOVES":
      return "How many cards will change hands tonight?";
    case "SWAP_OR_NOT":
      return "Swap these two cards, or leave them as they are?";
    case "ACKNOWLEDGE":
      return "Remember what you sensed.";
  }
}

function pickCount(option: NightActionOption): number {
  return option.type === "SWAP_PLAYERS" || option.type === "INSPECT_PAIR" || option.type === "INSPECT_CENTER" ? 2 : 1;
}

export function NightAction({ game, me, prompt }: { game: PublicGameView; me: PrivatePlayerView; prompt: NightPrompt }) {
  const role = prompt.role;
  const p = ROLE_PRESENTATION[role];
  const [mode, setMode] = useState<NightActionOption["type"] | null>(prompt.options.length === 1 ? prompt.options[0].type : null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCard, setShowCard] = useState(false);

  // Krishna's second stage replaces the option set.
  const optionKey = prompt.options.map((o) => o.type).join(",");
  useEffect(() => {
    setMode(prompt.options.length === 1 ? prompt.options[0].type : null);
    setSelected([]);
    setError(null);
    // Only reset when the *kind* of prompt changes, not on every state push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey]);

  const option = prompt.options.find((o) => o.type === mode) ?? null;
  const nameOf = (id: string) => game.players.find((pl) => pl.id === id)?.displayName ?? "Someone";

  async function submit(input: NightActionInput) {
    setBusy(true);
    setError(null);
    const ack = await send("night.action", input);
    setBusy(false);
    if (!ack.ok) setError(ack.message);
  }

  const header = (
    <header className="flex flex-col items-center gap-1 text-center">
      <Eyebrow>🌙 Your turn</Eyebrow>
      <p className="text-sm tracking-wide text-muted">You are</p>
      <button type="button" onClick={() => setShowCard((v) => !v)} className="state-layer flex items-center gap-3 rounded-full py-1 pl-1 pr-5 font-serif text-[28px] leading-9" aria-expanded={showCard}>
        <RoleAvatar role={role} deck={game.deck} size="lg" />
        {p.name}
      </button>
      <p className="text-xs tracking-wide text-gold">{p.title}</p>
      <div className="mt-2">
        <Countdown deadline={prompt.deadline} size="sm" />
      </div>
      {showCard && (
        <div className="mt-3 w-full">
          <RoleCard role={role} deck={game.deck} compact />
        </div>
      )}
    </header>
  );

  // Sahadeva: choose what to seek.
  if (!option) {
    return (
      <Screen>
        {header}
        <Title className="text-center text-2xl">What do you seek?</Title>
        <BottomActions>
          {prompt.options.map((o) => (
            <Button key={o.type} variant="secondary" onClick={() => setMode(o.type)}>
              {MODE_LABELS[o.type] ?? o.type}
            </Button>
          ))}
        </BottomActions>
      </Screen>
    );
  }

  const back = prompt.options.length > 1 && (
    <Button variant="ghost" onClick={() => (setMode(null), setSelected([]))}>
      ← Choose again
    </Button>
  );

  if (option.type === "ACKNOWLEDGE") {
    const vision = me.knownInformation.filter((k) => k.source === role);
    return (
      <Screen>
        {header}
        <p className="text-center text-muted">{instruction(role, option)}</p>
        <KnowledgeList items={vision} players={game.players} meId={me.playerId} title="Your vision" />
        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy} onClick={() => submit({ type: "ACKNOWLEDGE" })}>
            Continue
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  if (option.type === "SWAP_OR_NOT") {
    const [a, b] = option.targets;
    const readings = me.knownInformation.filter((k) => k.kind === "FACTION" && k.source === role && (k.playerId === a || k.playerId === b));
    return (
      <Screen>
        {header}
        <KnowledgeList items={readings.slice(-2)} players={game.players} meId={me.playerId} title="You read" />
        <p className="text-center text-muted">{instruction(role, option)}</p>
        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy} onClick={() => submit({ type: "SWAP_OR_NOT", targets: [a, b], swap: true })}>
            Swap {nameOf(a)} ↔ {nameOf(b)}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => submit({ type: "SWAP_OR_NOT", targets: [a, b], swap: false })}>
            Leave unchanged
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  if (option.type === "PREDICT_MOVES") {
    return (
      <Screen>
        {header}
        <p className="text-center text-lg">{instruction(role, option)}</p>
        <div role="radiogroup" aria-label="Predicted card movements" className="grid grid-cols-5 gap-2">
          {option.choices.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected[0] === c}
              onClick={() => setSelected([c])}
              className={`min-h-[64px] rounded-xl border text-xl font-semibold ${selected[0] === c ? "border-primary bg-primary-container text-on-primary-container" : "border-line bg-panel"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted">Each card that changes hands counts once. A swap moves two cards.</p>
        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy || !selected[0]} onClick={() => submit({ type: "PREDICT_MOVES", count: selected[0] as MovementCountGuess })}>
            Seal prediction
          </Button>
        </BottomActions>
      </Screen>
    );
  }

  const need = pickCount(option);
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : need === 1 ? [id] : cur.length < need ? [...cur, id] : [cur[1], id]));

  if (option.type === "INSPECT_CENTER") {
    return (
      <Screen>
        {header}
        <p className="text-center text-lg">{instruction(role, option)}</p>
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Centre cards">
          {option.slots.map((slot) => {
            const on = selected.includes(String(slot));
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(String(slot))}
                className={`flex aspect-[2/3] items-center justify-center rounded-xl border-2 font-serif text-2xl ${on ? "border-primary bg-primary-container text-on-primary-container" : "border-gold/40 bg-panel text-gold/70"}`}
              >
                {slot + 1}
              </button>
            );
          })}
        </div>
        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button
            disabled={busy || selected.length !== 2}
            onClick={() => submit({ type: "INSPECT_CENTER", slots: [Number(selected[0]) as CenterSlot, Number(selected[1]) as CenterSlot] })}
          >
            Confirm
          </Button>
          {back}
        </BottomActions>
      </Screen>
    );
  }

  const targets = (option as { targets: PlayerId[] }).targets;
  const inputFor = (): NightActionInput | null => {
    if (selected.length !== need) return null;
    const [a, b] = selected as PlayerId[];
    switch (option.type) {
      case "SWAP_PLAYERS":
      case "INSPECT_PAIR":
        return { type: option.type, targets: [a, b] };
      case "INSPECT_PLAYER":
      case "PROTECT_PLAYER":
      case "ARROW_TARGET":
      case "CHOOSE_PLAYER":
        return { type: option.type, target: a };
      default:
        return null;
    }
  };

  return (
    <Screen>
      {header}
      <p className="text-center text-lg leading-snug">{instruction(role, option)}</p>
      <PlayerPicker players={game.players} ids={targets} selected={selected} onToggle={toggle} meId={me.playerId} />
      <BottomActions>
        {need === 2 && (
          <p className="text-center text-sm text-muted" aria-live="polite">
            Selected: {selected.length ? selected.map(nameOf).join(" + ") : "none"}
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy || !inputFor()} onClick={() => inputFor() && submit(inputFor()!)}>
          Confirm
        </Button>
        {back}
      </BottomActions>
    </Screen>
  );
}

export function PlayerPicker({
  players,
  ids,
  selected,
  onToggle,
  meId,
}: {
  players: PublicGameView["players"];
  ids: string[];
  selected: string[];
  onToggle: (id: string) => void;
  meId?: string;
}) {
  const options = useMemo(() => players.filter((p) => ids.includes(p.id)), [players, ids]);
  return (
    <ul className="flex flex-col gap-2" role="group" aria-label="Players">
      {options.map((pl, i) => {
        const on = selected.includes(pl.id);
        const order = selected.indexOf(pl.id);
        return (
          <li key={pl.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(pl.id)}
              className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 text-left text-base transition ${on ? "border-primary bg-primary-container text-on-primary-container" : "border-line bg-panel hover:border-gold/50"}`}
            >
              <span className="w-5 text-right font-mono text-sm text-muted">{i + 1}.</span>
              <PlayerAvatar player={pl} size="sm" />
              <span className="flex-1 truncate">
                {pl.displayName}
                {pl.id === meId && <span className="text-muted"> (you)</span>}
              </span>
              <span aria-hidden className={`text-lg ${on ? "text-saffron" : "text-line"}`}>
                {on ? (selected.length > 1 ? `${order + 1}` : "●") : "○"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
