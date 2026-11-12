"use client";

import { useEffect } from "react";
import { useGameStore } from "@/game/gameStore";
import { connectSocket, disconnectSocket } from "@/websocket/socket";
import { Discussion } from "./Discussion";
import { Lobby } from "./Lobby";
import { NightAction } from "./NightAction";
import { NightWaiting } from "./NightWaiting";
import { Resolution } from "./Resolution";
import { Results } from "./Results";
import { RoleReveal } from "./RoleReveal";
import { BottomActions, Eyebrow, LinkButton, Screen, Title } from "./ui";
import { Voting } from "./VoteGrid";

export function GameClient({ roomCode }: { roomCode: string }) {
  const status = useGameStore((s) => s.status);
  const game = useGameStore((s) => s.game);
  const me = useGameStore((s) => s.me);
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
      useGameStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error, setError]);

  if (status === "no-session") {
    return (
      <Screen className="justify-center text-center">
        <Eyebrow>Sabha {roomCode}</Eyebrow>
        <Title>You do not have a seat in this Sabha.</Title>
        <p className="text-muted">Join with the room code to take your place.</p>
        <BottomActions>
          <LinkButton href={`/join?code=${encodeURIComponent(roomCode)}`}>Join Sabha</LinkButton>
          <LinkButton href="/" variant="ghost">Home</LinkButton>
        </BottomActions>
      </Screen>
    );
  }

  if (!game || !me) {
    return (
      <Screen className="items-center justify-center">
        <p className="animate-glow font-serif text-xl text-muted" role="status">
          Entering the Sabha…
        </p>
      </Screen>
    );
  }

  if (game.roomCode !== roomCode.toUpperCase()) {
    return (
      <Screen className="justify-center text-center">
        <Title>You are seated in Sabha {game.roomCode}.</Title>
        <BottomActions>
          <LinkButton href={`/game/${game.roomCode}`}>Go to my Sabha</LinkButton>
          <LinkButton href={`/join?code=${encodeURIComponent(roomCode)}`} variant="secondary">Join {roomCode.toUpperCase()} instead</LinkButton>
        </BottomActions>
      </Screen>
    );
  }

  const nightPrompt = me.availableActions.find((a) => a.kind === "NIGHT_ACTION");

  let body: React.ReactNode;
  switch (game.phase) {
    case "LOBBY":
      body = <Lobby game={game} me={me} />;
      break;
    case "ROLE_REVEAL":
      body = <RoleReveal game={game} me={me} />;
      break;
    case "NIGHT":
      body =
        nightPrompt && nightPrompt.kind === "NIGHT_ACTION" ? (
          <NightAction game={game} me={me} prompt={nightPrompt} />
        ) : (
          <NightWaiting game={game} me={me} />
        );
      break;
    case "DISCUSSION":
      body = <Discussion game={game} me={me} />;
      break;
    case "VOTING":
      body = <Voting game={game} me={me} />;
      break;
    case "RESOLUTION":
      body = <Resolution game={game} me={me} />;
      break;
    case "RESULTS":
      body = <Results game={game} me={me} />;
      break;
    default:
      body = (
        <Screen className="justify-center text-center">
          <Title>This Sabha has ended.</Title>
          <BottomActions>
            <LinkButton href="/">Home</LinkButton>
          </BottomActions>
        </Screen>
      );
  }

  return (
    <>
      {status === "reconnecting" && (
        <div role="status" className="mb-3 rounded-xl border border-kuru/40 bg-kuru/10 px-4 py-2 text-center text-sm text-kuru">
          Reconnecting to the Sabha…
        </div>
      )}
      {body}
      {error && (
        <div role="alert" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-[440px] rounded bg-on-surface px-4 py-3.5 text-sm text-surface shadow-elevation-3">
          {error.message}
        </div>
      )}
    </>
  );
}
