import { Faction, FACTION_PRESENTATION, ROLE_IDS, ROLE_PRESENTATION } from "@sabha/protocol";
import { LinkButton } from "@/components/ui";

const FACTION_ORDER = [Faction.DHARMA, Faction.KAURAVA, Faction.KURU, Faction.INDEPENDENT];

export const metadata = { title: "How to play · Sabha of Hastinapur" };

export default function HowToPlay() {
  return (
    <article className="flex flex-col gap-6 pb-8 animate-rise">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-saffron">How to play</p>
        <h1 className="mt-2 font-serif text-3xl">Players are people. Cards are identities.</h1>
      </header>

      <ol className="flex flex-col gap-4 text-[15px] leading-relaxed">
        <li>
          <strong className="text-parchment">1. The deal.</strong> Every player gets one secret card; three more lie face-down in the
          centre. Tap to reveal yours, then hide it.
        </li>
        <li>
          <strong className="text-parchment">2. The night.</strong> Your <em>starting</em> card decides what you may do. Some
          characters look at cards, some swap them, some protect. You never gain a new power from a card you receive.
        </li>
        <li>
          <strong className="text-parchment">3. The Sabha opens.</strong> Put the phones down and talk for five minutes. Claim,
          bluff, accuse.
        </li>
        <li>
          <strong className="text-parchment">4. Judgement.</strong> Everyone secretly votes. The player with the most votes is
          removed — and if the vote ties, <em>every</em> tied player is removed. Nobody votes, nobody falls.
        </li>
        <li>
          <strong className="text-parchment">5. Dawn.</strong> Your <em>final</em> card — whatever you hold after the night —
          decides your side and whether you won.
        </li>
      </ol>

      <section className="rounded-3xl border border-line bg-panel/80 p-5 text-[15px] leading-relaxed">
        <h2 className="mb-2 font-serif text-xl">The two sides</h2>
        <p>
          <span aria-hidden>🔵</span> <strong>Dharma</strong> wins if at least one Kaurava Conspirator (Duryodhana, Shakuni,
          Dushasana, Ashwatthama) is removed. If no conspirator sits in the Sabha, Dharma wins if anyone is removed.
        </p>
        <p className="mt-2">
          <span aria-hidden>🔴</span> <strong>Kaurava</strong> wins if no Conspirator is removed. Karna is loyal to the
          Kauravas but is <em>not</em> a Conspirator — and he must survive too.
        </p>
        <p className="mt-2">
          <span aria-hidden>🟡</span> <strong>Kuru</strong> and <span aria-hidden>⚪</span> <strong>Independent</strong> characters
          each chase a personal goal.
        </p>
      </section>

      {FACTION_ORDER.map((faction) => (
        <section key={faction}>
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-muted">
            {FACTION_PRESENTATION[faction].icon} {FACTION_PRESENTATION[faction].label}
          </h2>
          <ul className="flex flex-col gap-2">
            {ROLE_IDS.filter((r) => ROLE_PRESENTATION[r].faction === faction).map((r) => {
              const p = ROLE_PRESENTATION[r];
              return (
                <li key={r} className="rounded-2xl border border-line bg-panel px-4 py-3">
                  <p className="font-serif text-lg">
                    <span aria-hidden>{p.icon}</span> {p.name} <span className="text-xs uppercase tracking-[0.2em] text-gold">{p.title}</span>
                  </p>
                  <p className="text-sm text-muted">Night: {p.night}</p>
                  {p.ability && <p className="text-sm text-muted">{p.ability}</p>}
                  <p className="text-sm">Goal: {p.objective}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-xs text-muted">
        Night order: Bhishma → Nakula &amp; Sahadeva → Shakuni → Krishna → Vidura → Draupadi → Drona → Arjuna → Sanjaya → Gandhari.
        All mechanics are game adaptations inspired by the Mahabharata, not claims about the epic.
      </p>

      <LinkButton href="/">Back</LinkButton>
    </article>
  );
}
