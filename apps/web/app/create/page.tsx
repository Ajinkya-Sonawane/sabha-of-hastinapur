"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODE_PRESENTATION, type GameMode } from "@sabha/protocol";
import { ApiError, createGame } from "@/game/api";
import { BottomActions, Button, ErrorText, Eyebrow, Screen, Title } from "@/components/ui";

const COUNTS = [5, 6, 7, 8, 9, 10];
const MODES: GameMode[] = ["BEGINNER", "STANDARD", "ADVANCED"];

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<GameMode>("BEGINNER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 20;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Names must be 2-20 characters.");
    setBusy(true);
    setError(null);
    try {
      const session = await createGame(trimmed, count, mode);
      router.push(`/game/${session.roomCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <form onSubmit={submit} className="flex flex-1 flex-col gap-6" noValidate>
        <header>
          <Eyebrow>Create Sabha</Eyebrow>
          <Title className="mt-2">Gather the court.</Title>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-xs tracking-wide text-muted">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoComplete="nickname"
            autoFocus
            className="min-h-14 rounded border border-outline bg-transparent px-4 text-base text-parchment placeholder:text-muted/60 focus:border-saffron"
            placeholder="Your name"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs tracking-wide text-muted">Players</legend>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Number of players">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                onClick={() => setCount(n)}
                className={`min-h-[52px] rounded-xl border text-lg font-semibold ${count === n ? "border-primary bg-primary-container text-on-primary-container" : "border-line bg-panel"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs tracking-wide text-muted">Game mode</legend>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Game mode">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`flex min-h-[56px] items-start gap-3 rounded-xl border px-4 py-3 text-left ${mode === m ? "border-primary bg-primary-container text-on-primary-container" : "border-line bg-panel"}`}
              >
                <span aria-hidden className={`mt-0.5 ${mode === m ? "text-saffron" : "text-muted"}`}>{mode === m ? "●" : "○"}</span>
                <span>
                  <span className="block font-semibold">{MODE_PRESENTATION[m].label}</span>
                  <span className="block text-sm text-muted">{MODE_PRESENTATION[m].description}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <BottomActions>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || !valid}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back
          </Button>
        </BottomActions>
      </form>
    </Screen>
  );
}
