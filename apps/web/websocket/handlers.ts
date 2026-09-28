import type { ServerEvent } from "@sabha/protocol";
import { useGameStore } from "@/game/gameStore";

/** Apply one server event to the client store. */
export function handleServerEvent(event: ServerEvent): void {
  const store = useGameStore.getState();
  switch (event.type) {
    case "session.restore":
      store.setGame(event.payload.game);
      store.setMe(event.payload.privateState);
      store.setServerOffset(event.payload.serverTime - Date.now());
      store.setStatus("connected");
      break;
    case "session.none":
      store.setStatus("no-session");
      break;
    case "room.state":
      store.setGame(event.payload);
      break;
    case "player.private_state":
      store.setMe(event.payload);
      break;
    case "night.prompt":
      store.bumpNudge();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(180);
      break;
    case "error":
      store.setError({ code: event.payload.code, message: event.payload.message });
      break;
    default:
      break;
  }
}
