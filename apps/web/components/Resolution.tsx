"use client";

import { useState } from "react";
import type { AvailableAction, PrivatePlayerView, PublicGameView } from "@sabha/protocol";
import { ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { send } from "@/websocket/socket";
import { Countdown } from "./Countdown";
import { PlayerPicker } from "./NightAction";
import { RoleAvatar } from "./RoleCard";
import { VoteReveal } from "./VoteReveal";
import { BottomActions, Button, ErrorText, Eyebrow, Screen, Title } from "./ui";

type FinalAct = Extract<AvailableAction, { kind: "SPECIAL_ELIMINATION" }>;

export function Resolution({ game, me }: { game: PublicGameView; me: PrivatePlayerView }) {
  const act = me.availableActions.find((a): a is FinalAct => a.kind === "SPECIAL_ELIMINATION");
  const resolution = game.resolution;

  if (act) return <FinalActPicker game={game} me={me} act={act} />;

  return (
    <Screen className="justify-center">
      {resolution && <VoteReveal game={game} result={resolution.voteResult} />}
      {resolution && resolution.pendingFinalActs > 0 && (
        <p className="mt-6 text-center font-serif text-lg text-muted animate-glow">A fallen warrior has one final act…</p>
      )}
    </Screen>
  );
}

function FinalActPicker({ game, me, act }: { game: PublicGameView; me: PrivatePlayerView; act: FinalAct }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const role = ROLE_PRESENTATION[act.role];
  return (
    <Screen>
      <header className="text-center">
        <div className="mb-3 flex justify-center">
          <RoleAvatar role={act.role} deck={game.deck} size="xl" />
        </div>
        <Eyebrow>You have fallen</Eyebrow>
        <Title className="mt-2">
          As {role.name}, choose one to fall with you.
        </Title>
        <div className="mt-3 flex justify-center">
          <Countdown deadline={act.deadline} size="sm" />
        </div>
      </header>
      <PlayerPicker players={game.players} ids={act.targets} selected={selected} onToggle={(id) => setSelected([id])} meId={me.playerId} />
      <BottomActions>
        <ErrorText>{error}</ErrorText>
        <Button
          disabled={busy || selected.length !== 1}
          onClick={async () => {
            setBusy(true);
            const ack = await send("special.elimination", { targetPlayerId: selected[0] });
            setBusy(false);
            if (!ack.ok) setError(ack.message);
          }}
        >
          Strike
        </Button>
      </BottomActions>
    </Screen>
  );
}
