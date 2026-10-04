"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getRoom, joinGame } from "@/game/api";
import { BottomActions, Button, ErrorText, Eyebrow, Screen, Title } from "@/components/ui";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => clean(params.get("code") ?? ""));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seated, setSeated] = useState(false);

  useEffect(() => {
    if (code.length !== 6) return setSeated(false);
    let cancelled = false;
    getRoom(code)
      .then((room) => !cancelled && setSeated(room.seated))
      .catch(() => !cancelled && setSeated(false));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const valid = code.length === 6 && name.trim().length >= 2 && name.trim().length <= 20;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const session = await joinGame(code, name.trim());
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
          <Eyebrow>Join Sabha</Eyebrow>
          <Title className="mt-2">Take your seat.</Title>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-muted">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="KURU42"
            aria-describedby="code-hint"
            className="min-h-[64px] rounded-2xl border border-line bg-panel px-4 text-center font-mono text-3xl uppercase tracking-[0.4em] text-saffron placeholder:text-muted/40 focus:border-saffron"
          />
          <span id="code-hint" className="text-sm text-muted">
            Six characters, from the host&apos;s phone.
          </span>
        </label>

        {seated ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm">You already have a seat in this Sabha.</p>
            <Button onClick={() => router.push(`/game/${code}`)}>Return to my seat</Button>
          </div>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-muted">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Your name"
              className="min-h-[52px] rounded-2xl border border-line bg-panel px-4 text-lg placeholder:text-muted/60 focus:border-saffron"
            />
          </label>
        )}

        <BottomActions>
          <ErrorText>{error}</ErrorText>
          {!seated && (
            <Button type="submit" disabled={busy || !valid}>
              {busy ? "Joining…" : "Join"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back
          </Button>
        </BottomActions>
      </form>
    </Screen>
  );
}
