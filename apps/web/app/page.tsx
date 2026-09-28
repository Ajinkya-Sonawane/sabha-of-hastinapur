import Link from "next/link";

export default function Landing() {
  return (
    <section className="flex flex-1 flex-col animate-rise">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p aria-hidden className="mb-6 text-5xl">🪷</p>
        <p className="text-xs font-semibold uppercase tracking-[0.5em] text-saffron">Sabha</p>
        <h1 className="mt-2 font-serif text-5xl leading-none tracking-[0.04em]">
          <span className="block text-lg uppercase tracking-[0.5em] text-muted">of</span>
          Hastinapur
        </h1>
        <p className="mt-6 max-w-[300px] font-serif text-lg leading-snug text-muted">
          One night of court intrigue. Cards move in the dark. At dawn, the Sabha must judge.
        </p>
        <p className="mt-3 text-sm uppercase tracking-[0.25em] text-muted">5–10 players · one phone each</p>
      </div>
      <nav className="flex flex-col gap-3">
        <Link
          href="/create"
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-saffron text-base font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-gold"
        >
          Create Sabha
        </Link>
        <Link
          href="/join"
          className="flex min-h-[56px] items-center justify-center rounded-2xl border border-line bg-panel text-base font-semibold uppercase tracking-[0.14em] hover:border-saffron/70"
        >
          Join Sabha
        </Link>
        <Link href="/how-to-play" className="flex min-h-[44px] items-center justify-center text-muted underline-offset-4 hover:text-parchment hover:underline">
          How to play
        </Link>
      </nav>
      <p className="mt-4 text-center text-[11px] leading-snug text-muted/70">
        Inspired by the Mahabharata. All mechanics are game adaptations, not canonical claims.
      </p>
    </section>
  );
}
